import {
	type ReactFlowInstance,
	useEdgesState,
	useNodesState,
} from "@xyflow/react";
import {
	Group as PanelGroup,
	Panel,
} from "react-resizable-panels";
import {
	useDeferredValue,
	startTransition,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";

import { Canvas } from "@/components/Canvas";
import { Editor } from "@/components/Editor";
import { Toolbar } from "@/components/Toolbar";
import { useDbmlParser } from "@/hooks/useDbmlParser";
import { autoLayoutDiagram } from "@/lib/layout";
import { SAMPLE_DBML } from "@/lib/sample-dbml";
import { loadSharedSchema, saveSharedSchema } from "@/lib/sharing";
import { buildDiagram } from "@/lib/transform";
import { useDiagramUiStore } from "@/store/useDiagramUiStore";
import type {
	DiagramEdge,
	DiagramNode,
	DiagramNodeSize,
	DiagramPositions,
	ParsedSchema,
	SchemaPayload,
} from "@/types";

const SHARE_PATH_PATTERN = /^\/s\/([A-Za-z0-9_-]+)$/;

const getShareIdFromPath = (pathname: string) =>
	SHARE_PATH_PATTERN.exec(pathname)?.[1] ?? null;

const getPositionsFromNodes = (nodes: readonly DiagramNode[]): DiagramPositions =>
	Object.fromEntries(nodes.map((node) => [node.id, node.position]));

const pickKnownPositions = (
	nodeIds: readonly string[],
	currentPositions: DiagramPositions,
	seedPositions: DiagramPositions,
) =>
	Object.fromEntries(
		nodeIds.flatMap((nodeId) => {
			const position = currentPositions[nodeId] ?? seedPositions[nodeId];
			return position ? [[nodeId, position]] : [];
		}),
	);

const createDiagramSearchState = (
	parsed: ParsedSchema,
	rawQuery: string,
): {
	matchedTableIds: string[];
	relatedTableIds: string[];
	highlightedEdgeIds: string[];
} => {
	const query = rawQuery.trim().toLowerCase();
	if (query.length === 0) {
		return {
			matchedTableIds: [],
			relatedTableIds: [],
			highlightedEdgeIds: [],
		};
	}

	const matchedTableIds = new Set<string>();

	for (const table of parsed.tables) {
		const identifiers = [
			table.name,
			table.id,
			table.schema ? `${table.schema}.${table.name}` : null,
		];

		if (
			identifiers.some(
				(identifier) => identifier !== null && identifier.toLowerCase().includes(query),
			)
		) {
			matchedTableIds.add(table.id);
		}
	}

	if (matchedTableIds.size === 0) {
		return {
			matchedTableIds: [],
			relatedTableIds: [],
			highlightedEdgeIds: [],
		};
	}

	const relatedTableIds = new Set<string>();
	const highlightedEdgeIds = new Set<string>();

	for (const ref of parsed.refs) {
		if (matchedTableIds.has(ref.from.table) || matchedTableIds.has(ref.to.table)) {
			relatedTableIds.add(ref.from.table);
			relatedTableIds.add(ref.to.table);
			highlightedEdgeIds.add(ref.id);
		}
	}

	for (const tableId of matchedTableIds) {
		relatedTableIds.delete(tableId);
	}

	return {
		matchedTableIds: Array.from(matchedTableIds).sort(),
		relatedTableIds: Array.from(relatedTableIds).sort(),
		highlightedEdgeIds: Array.from(highlightedEdgeIds).sort(),
	};
};

function App() {
	const initialShareId = getShareIdFromPath(window.location.pathname);
	const [dbml, setDbml] = useState(initialShareId ? "" : SAMPLE_DBML);
	const [shareSeedPositions, setShareSeedPositions] = useState<DiagramPositions>({});
	const [currentShareId, setCurrentShareId] = useState<string | null>(initialShareId);
	const [viewedShareId, setViewedShareId] = useState<string | null>(initialShareId);
	const [shareLoadError, setShareLoadError] = useState<string | null>(null);
	const [isLoadingShare, setIsLoadingShare] = useState(Boolean(initialShareId));
	const [isSharing, setIsSharing] = useState(false);
	const [isLayouting, setIsLayouting] = useState(false);
	const [viewportZoom, setViewportZoom] = useState(1);
	const [nodeMeasurements, setNodeMeasurements] = useState<
		Record<string, DiagramNodeSize>
	>({});
	const [needsMeasuredLayout, setNeedsMeasuredLayout] = useState(false);
	const [nodes, setNodes, onNodesChange] = useNodesState<DiagramNode>([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState<DiagramEdge>([]);
	const { parsed, diagnostics, isParsing } = useDbmlParser(dbml);
	const gridMode = useDiagramUiStore((state) => state.gridMode);
	const layoutAlgorithm = useDiagramUiStore((state) => state.layoutAlgorithm);
	const searchQuery = useDiagramUiStore((state) => state.searchQuery);
	const deferredSearchQuery = useDeferredValue(searchQuery);
	const searchState = createDiagramSearchState(parsed, deferredSearchQuery);
	const matchedTableNames = parsed.tables
		.filter((table) => searchState.matchedTableIds.includes(table.id))
		.map((table) => (table.schema ? `${table.schema}.${table.name}` : table.name));
	const searchFocusKey = [
		...searchState.matchedTableIds,
		...searchState.relatedTableIds,
	].join("|");
	const reactFlowRef = useRef<ReactFlowInstance<DiagramNode, DiagramEdge> | null>(
		null,
	);
	const nodesRef = useRef<DiagramNode[]>([]);

	useEffect(() => {
		nodesRef.current = nodes;
	}, [nodes]);

	useEffect(() => {
		const onPopState = () => {
			setViewedShareId(getShareIdFromPath(window.location.pathname));
		};

		window.addEventListener("popstate", onPopState);

		return () => {
			window.removeEventListener("popstate", onPopState);
		};
	}, []);

	const requestFitView = useCallback((nodeIds?: readonly string[]) => {
		const focusedIds =
			nodeIds && nodeIds.length > 0 ? Array.from(new Set(nodeIds)) : undefined;

		requestAnimationFrame(() => {
			const instance = reactFlowRef.current;
			if (!instance) {
				return;
			}

			void instance.fitView({
				padding: 0.16,
				duration: 500,
				nodes: focusedIds?.map((id) => ({ id })),
			});
		});
	}, []);

	const handleMeasure = useCallback((nodeId: string, size: DiagramNodeSize) => {
		setNodeMeasurements((current) => {
			const previous = current[nodeId];
			if (previous && previous.width === size.width && previous.height === size.height) {
				return current;
			}

			return {
				...current,
				[nodeId]: size,
			};
		});
	}, []);

	const applyAutoLayout = useCallback(
		async ({
			positions = {},
			fitView = false,
			enableMeasuredFollowUp = false,
		}: {
			positions?: DiagramPositions;
			fitView?: boolean;
			enableMeasuredFollowUp?: boolean;
		}) => {
			const nextSearchState = createDiagramSearchState(parsed, deferredSearchQuery);
			const searchContext = {
				matchedTableIds: new Set(nextSearchState.matchedTableIds),
				relatedTableIds: new Set(nextSearchState.relatedTableIds),
				highlightedEdgeIds: new Set(nextSearchState.highlightedEdgeIds),
			};
			const diagram = buildDiagram(parsed, {
				positions,
				measurements: nodeMeasurements,
				onMeasure: handleMeasure,
				search: searchContext,
			});

			setIsLayouting(true);

			try {
				const laidOutNodes = await autoLayoutDiagram(
					diagram.nodes,
					diagram.edges,
					layoutAlgorithm,
				);
				startTransition(() => {
					setNodes(laidOutNodes);
					setEdges(diagram.edges);
				});
				setNeedsMeasuredLayout(enableMeasuredFollowUp);

				if (fitView) {
					requestFitView(
						searchFocusKey.length > 0 ? searchFocusKey.split("|") : undefined,
					);
				}
			} catch (error) {
				toast.error(
					error instanceof Error ? error.message : "Unable to auto-layout schema.",
				);
			} finally {
				setIsLayouting(false);
			}
		},
		[
			deferredSearchQuery,
			handleMeasure,
			layoutAlgorithm,
			nodeMeasurements,
			parsed,
			requestFitView,
			searchFocusKey,
			setEdges,
			setNodes,
		],
	);

	useEffect(() => {
		if (viewedShareId !== null) {
			return;
		}

		setIsLoadingShare(false);
		setShareLoadError(null);
	}, [viewedShareId]);

	useEffect(() => {
		let cancelled = false;

		if (!viewedShareId) {
			return;
		}

		setIsLoadingShare(true);
		setShareLoadError(null);
		startTransition(() => {
			setNodes([]);
			setEdges([]);
			setNodeMeasurements({});
		});

		void loadSharedSchema(viewedShareId)
			.then((payload) => {
				if (cancelled) {
					return;
				}

				startTransition(() => {
					setDbml(payload.dbml);
					setShareSeedPositions(payload.positions);
					setCurrentShareId(viewedShareId);
					setNodeMeasurements({});
				});
				requestFitView();
			})
			.catch((error) => {
				if (cancelled) {
					return;
				}

				setShareLoadError(
					error instanceof Error
						? error.message
						: "Unable to load the shared schema.",
				);
				startTransition(() => {
					setDbml("");
					setShareSeedPositions({});
					setCurrentShareId(null);
				});
			})
			.finally(() => {
				if (!cancelled) {
					setIsLoadingShare(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [requestFitView, setEdges, setNodes, viewedShareId]);

	useEffect(() => {
		if (!viewedShareId && dbml.length === 0) {
			setDbml(SAMPLE_DBML);
		}
	}, [dbml.length, viewedShareId]);

	useEffect(() => {
		const preferredPositions = pickKnownPositions(
			parsed.tables.map((table) => table.id),
			getPositionsFromNodes(nodesRef.current),
			shareSeedPositions,
		);
		const currentSearchState = createDiagramSearchState(parsed, deferredSearchQuery);
		const searchContext = {
			matchedTableIds: new Set(currentSearchState.matchedTableIds),
			relatedTableIds: new Set(currentSearchState.relatedTableIds),
			highlightedEdgeIds: new Set(currentSearchState.highlightedEdgeIds),
		};
		const diagram = buildDiagram(parsed, {
			positions: preferredPositions,
			measurements: nodeMeasurements,
			onMeasure: handleMeasure,
			search: searchContext,
		});
		const needsInitialAutoLayout =
			diagram.nodes.length > 0 && Object.keys(preferredPositions).length === 0;

		if (needsInitialAutoLayout) {
			void applyAutoLayout({
				fitView: true,
				enableMeasuredFollowUp:
					Object.keys(nodeMeasurements).length < parsed.tables.length,
			});
			return;
		}

		startTransition(() => {
			setNodes(diagram.nodes);
			setEdges(diagram.edges);
		});
	}, [
		applyAutoLayout,
		deferredSearchQuery,
		handleMeasure,
		nodeMeasurements,
		parsed,
		setEdges,
		setNodes,
		shareSeedPositions,
	]);

	useEffect(() => {
		if (searchFocusKey.length === 0) {
			return;
		}

		requestFitView(searchFocusKey.split("|"));
	}, [requestFitView, searchFocusKey]);

	useEffect(() => {
		if (!needsMeasuredLayout || isLayouting || parsed.tables.length === 0) {
			return;
		}

		const allVisibleTablesMeasured = parsed.tables.every(
			(table) => nodeMeasurements[table.id],
		);
		if (!allVisibleTablesMeasured) {
			return;
		}

		setNeedsMeasuredLayout(false);
		void applyAutoLayout({
			fitView: true,
		});
	}, [applyAutoLayout, isLayouting, needsMeasuredLayout, nodeMeasurements, parsed.tables]);

	const handleAutoLayoutClick = () => {
		void applyAutoLayout({
			fitView: true,
		});
	};

	const handleFitViewClick = () => {
		requestFitView(searchFocusKey.length > 0 ? searchFocusKey.split("|") : undefined);
	};

	const handleZoomInClick = () => {
		void reactFlowRef.current?.zoomIn({ duration: 180 });
	};

	const handleZoomOutClick = () => {
		void reactFlowRef.current?.zoomOut({ duration: 180 });
	};

	const handleShare = async () => {
		setIsSharing(true);

		try {
			const positions = getPositionsFromNodes(nodesRef.current);
			const payload: SchemaPayload = {
				dbml,
				positions,
				version: 1,
			};
			const result = await saveSharedSchema(payload);
			const nextUrl = new URL(`/s/${result.id}`, window.location.origin).toString();

			try {
				await navigator.clipboard.writeText(nextUrl);
				toast.success("Share link copied to clipboard.");
			} catch {
				toast.success("Share created.", {
					description: nextUrl,
				});
			}

			window.history.pushState({}, "", `/s/${result.id}`);
			setCurrentShareId(result.id);
			setShareSeedPositions(positions);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Unable to share this schema.",
			);
		} finally {
			setIsSharing(false);
		}
	};

	return (
		<div className="h-screen bg-background text-foreground">
			<div className="flex h-full flex-col">
				<Toolbar
					tableCount={parsed.tables.length}
					relationCount={parsed.refs.length}
					isSharing={isSharing}
					shareId={currentShareId}
					onShare={handleShare}
				/>

				{shareLoadError ? (
					<div className="border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
						Shared schema unavailable. {shareLoadError}
					</div>
				) : null}

				<PanelGroup orientation="horizontal" className="min-h-0 flex-1">
					<Panel defaultSize={30} minSize={18} className="min-w-0">
						<Editor
							value={dbml}
							diagnostics={diagnostics}
							isParsing={isParsing}
							onChange={setDbml}
						/>
					</Panel>
					<Panel defaultSize={70} minSize={24} className="min-w-0">
						<div className="h-full min-h-0 bg-background">
							<Canvas
								nodes={nodes}
								edges={edges}
								gridMode={gridMode}
								isBusy={isLoadingShare || isLayouting}
								isLayouting={isLayouting}
								matchedTableNames={matchedTableNames}
								zoom={viewportZoom}
								onAutoLayout={handleAutoLayoutClick}
								onNodesChange={onNodesChange}
								onEdgesChange={onEdgesChange}
								onFitView={handleFitViewClick}
								onInit={(instance) => {
									reactFlowRef.current = instance;
									setViewportZoom(instance.getZoom());
								}}
								onViewportChange={(viewport) => {
									setViewportZoom(viewport.zoom);
								}}
								onZoomIn={handleZoomInClick}
								onZoomOut={handleZoomOutClick}
							/>
						</div>
					</Panel>
				</PanelGroup>
			</div>
		</div>
	);
}

export default App;
