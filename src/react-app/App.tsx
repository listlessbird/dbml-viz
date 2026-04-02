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
import {
	buildDraftPayload,
	createDiagramRouteHref,
	getDraftHydrationResult,
	getDiagramRouteState,
	getInitialDraftState,
	isSameDiagramRoute,
	getPositionsFromNodes,
	resolveDraftPersistence,
} from "@/lib/draftPersistence";
import { autoLayoutDiagram } from "@/lib/layout";
import { SAMPLE_DBML } from "@/lib/sample-dbml";
import { loadSharedSchema, saveSharedSchema } from "@/lib/sharing";
import { buildDiagram } from "@/lib/transform";
import { getDiagramDraft, useDiagramDraftStore } from "@/store/useDiagramDraftStore";
import { useDiagramUiStore } from "@/store/useDiagramUiStore";
import type {
	DiagramEdge,
	DiagramNode,
	DiagramNodeSize,
	DiagramPositions,
	ParsedSchema,
	SchemaPayload,
} from "@/types";

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
	const initialRoute = getDiagramRouteState(
		window.location.pathname,
		window.location.search,
	);
	const initialLocalDraft = getDiagramDraft(initialRoute.shareId);
	const initialDraftState = getInitialDraftState({
		route: initialRoute,
		draft: initialLocalDraft,
		sampleDbml: SAMPLE_DBML,
	});
	const initialHydration = getDraftHydrationResult({
		route: initialRoute,
		draft: initialLocalDraft,
		sampleDbml: SAMPLE_DBML,
	});
	const [dbml, setDbml] = useState(() => initialDraftState.dbml);
	const [shareSeedPositions, setShareSeedPositions] = useState<DiagramPositions>(
		() => initialDraftState.positions,
	);
	const [viewedRoute, setViewedRoute] = useState(initialRoute);
	const [shareLoadError, setShareLoadError] = useState<string | null>(null);
	const [isLoadingShare, setIsLoadingShare] = useState(
		initialHydration.remoteLoadMode === "blocking",
	);
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
	const getDraft = useDiagramDraftStore((state) => state.getDraft);
	const setDraft = useDiagramDraftStore((state) => state.setDraft);
	const clearDraft = useDiagramDraftStore((state) => state.clearDraft);
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
	const [shareBaseline, setShareBaseline] = useState<{
		shareId: string;
		payload: SchemaPayload;
	} | null>(null);
	const currentShareBaseline =
		shareBaseline?.shareId === viewedRoute.shareId ? shareBaseline.payload : null;

	useEffect(() => {
		nodesRef.current = nodes;
	}, [nodes]);

	useEffect(() => {
		const onPopState = () => {
			setViewedRoute(
				getDiagramRouteState(window.location.pathname, window.location.search),
			);
		};

		window.addEventListener("popstate", onPopState);

		return () => {
			window.removeEventListener("popstate", onPopState);
		};
	}, []);

	useEffect(() => {
		setShareBaseline((current) => {
			if (viewedRoute.shareId === null) {
				return current === null ? current : null;
			}

			return current?.shareId === viewedRoute.shareId ? current : null;
		});
	}, [viewedRoute.shareId]);

	const replaceViewedRoute = useCallback((nextRoute: typeof viewedRoute) => {
		if (isSameDiagramRoute(nextRoute, viewedRoute)) {
			return;
		}

		window.history.replaceState({}, "", createDiagramRouteHref(nextRoute));
		setViewedRoute(nextRoute);
	}, [viewedRoute]);

	const pushViewedRoute = useCallback((nextRoute: typeof viewedRoute) => {
		if (isSameDiagramRoute(nextRoute, viewedRoute)) {
			return;
		}

		window.history.pushState({}, "", createDiagramRouteHref(nextRoute));
		setViewedRoute(nextRoute);
	}, [viewedRoute]);

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
		let cancelled = false;
		const localDraft = getDraft(viewedRoute.shareId);
		const hydration = getDraftHydrationResult({
			route: viewedRoute,
			draft: localDraft,
			sampleDbml: SAMPLE_DBML,
		});

		if (!isSameDiagramRoute(hydration.canonicalRoute, viewedRoute)) {
			replaceViewedRoute(hydration.canonicalRoute);
			return () => {
				cancelled = true;
			};
		}

		if (hydration.remoteLoadMode === "none") {
			setShareLoadError(null);
			setIsLoadingShare(false);
			startTransition(() => {
				setDbml(hydration.dbml);
				setShareSeedPositions(hydration.positions);
				setNodeMeasurements({});
			});
			return () => {
				cancelled = true;
			};
		}

		if (hydration.remoteLoadMode === "background") {
			setShareLoadError(null);
			setIsLoadingShare(false);
			startTransition(() => {
				setDbml(hydration.dbml);
				setShareSeedPositions(hydration.positions);
				setNodeMeasurements({});
			});

			if (viewedRoute.shareId !== null && currentShareBaseline === null) {
				const sharedId = viewedRoute.shareId;

				void loadSharedSchema(sharedId)
					.then((payload) => {
						if (cancelled) {
							return;
						}

						setShareBaseline({
							shareId: sharedId,
							payload,
						});
					})
					.catch(() => {});
			}

			return () => {
				cancelled = true;
			};
		}

		if (viewedRoute.shareId !== null && currentShareBaseline !== null) {
			setShareLoadError(null);
			setIsLoadingShare(false);

			if (hydration.clearLocalDraftOnRemoteLoad) {
				clearDraft(viewedRoute.shareId);
			}

			startTransition(() => {
				setDbml(currentShareBaseline.dbml);
				setShareSeedPositions(currentShareBaseline.positions);
				setNodeMeasurements({});
			});

			return () => {
				cancelled = true;
			};
		}

		setIsLoadingShare(true);
		setShareLoadError(null);
		startTransition(() => {
			setNodes([]);
			setEdges([]);
			setNodeMeasurements({});
		});
		const sharedId = viewedRoute.shareId;

		if (sharedId === null) {
			return () => {
				cancelled = true;
			};
		}

		void loadSharedSchema(sharedId)
			.then((payload) => {
				if (cancelled) {
					return;
				}

				setShareBaseline({
					shareId: sharedId,
					payload,
				});
				if (hydration.clearLocalDraftOnRemoteLoad) {
					clearDraft(sharedId);
				}
				startTransition(() => {
					setDbml(payload.dbml);
					setShareSeedPositions(payload.positions);
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
				setShareBaseline(null);
				startTransition(() => {
					setDbml("");
					setShareSeedPositions({});
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
	}, [
		clearDraft,
		currentShareBaseline,
		getDraft,
		requestFitView,
		replaceViewedRoute,
		setEdges,
		setNodes,
		viewedRoute,
	]);

	useEffect(() => {
		if (isLoadingShare) {
			return;
		}

		const payload = buildDraftPayload({
			dbml,
			nodes,
			fallbackPositions: shareSeedPositions,
		});
		const timeoutId = window.setTimeout(() => {
			const decision = resolveDraftPersistence({
				route: viewedRoute,
				payload,
				sampleDbml: SAMPLE_DBML,
				baseline: currentShareBaseline,
			});

			if (!isSameDiagramRoute(decision.nextRoute, viewedRoute)) {
				replaceViewedRoute(decision.nextRoute);
			}

			if (decision.shouldClearDraft) {
				clearDraft(viewedRoute.shareId);
			}

			if (decision.shouldStoreDraft) {
				setDraft(viewedRoute.shareId, payload);
			}
		}, 180);

		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [
		clearDraft,
		currentShareBaseline,
		dbml,
		isLoadingShare,
		nodes,
		replaceViewedRoute,
		setDraft,
		shareSeedPositions,
		viewedRoute,
	]);

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
			const payload = buildDraftPayload({
				dbml,
				nodes: nodesRef.current,
				fallbackPositions: shareSeedPositions,
			});
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

			if (viewedRoute.shareId !== null) {
				clearDraft(viewedRoute.shareId);
			}

			const nextRoute = {
				shareId: result.id,
				isDirty: false,
			} as const;
			pushViewedRoute(nextRoute);
			setShareSeedPositions(payload.positions);
			setShareBaseline({
				shareId: result.id,
				payload,
			});
			setShareLoadError(null);
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
					routeLabel={
						viewedRoute.shareId === null
							? "draft"
							: createDiagramRouteHref(viewedRoute)
					}
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
