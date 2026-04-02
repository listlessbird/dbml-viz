import {
	type ReactFlowInstance,
	useEdgesState,
	useNodesState,
} from "@xyflow/react";
import {
	Group as PanelGroup,
	Panel,
	Separator as PanelResizeHandle,
} from "react-resizable-panels";
import {
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
import type {
	DiagramEdge,
	DiagramNode,
	DiagramNodeSize,
	DiagramPositions,
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
	const [nodeMeasurements, setNodeMeasurements] = useState<
		Record<string, DiagramNodeSize>
	>({});
	const [needsMeasuredLayout, setNeedsMeasuredLayout] = useState(false);
	const [nodes, setNodes, onNodesChange] = useNodesState<DiagramNode>([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState<DiagramEdge>([]);
	const { parsed, diagnostics, isParsing } = useDbmlParser(dbml);
	const reactFlowRef = useRef<ReactFlowInstance<DiagramNode, DiagramEdge> | null>(
		null,
	);
	const nodesRef = useRef<DiagramNode[]>([]);
	const fitViewRequestedRef = useRef(false);

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

	const requestFitView = useCallback(() => {
		fitViewRequestedRef.current = true;

		requestAnimationFrame(() => {
			if (!fitViewRequestedRef.current) {
				return;
			}

			reactFlowRef.current?.fitView({
				padding: 0.16,
				duration: 500,
			});
			fitViewRequestedRef.current = false;
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
			const diagram = buildDiagram(parsed, {
				positions,
				measurements: nodeMeasurements,
				onMeasure: handleMeasure,
			});

			setIsLayouting(true);

			try {
				const laidOutNodes = await autoLayoutDiagram(diagram.nodes, diagram.edges);
				startTransition(() => {
					setNodes(laidOutNodes);
					setEdges(diagram.edges);
				});
				setNeedsMeasuredLayout(enableMeasuredFollowUp);

				if (fitView) {
					requestFitView();
				}
			} catch (error) {
				toast.error(
					error instanceof Error ? error.message : "Unable to auto-layout schema.",
				);
			} finally {
				setIsLayouting(false);
			}
		},
		[handleMeasure, nodeMeasurements, parsed, requestFitView, setEdges, setNodes],
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
		const diagram = buildDiagram(parsed, {
			positions: preferredPositions,
			measurements: nodeMeasurements,
			onMeasure: handleMeasure,
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
		handleMeasure,
		nodeMeasurements,
		parsed,
		setEdges,
		setNodes,
		shareSeedPositions,
	]);

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
		requestFitView();
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
					isLayouting={isLayouting}
					isSharing={isSharing}
					shareId={currentShareId}
					onAutoLayout={handleAutoLayoutClick}
					onFitView={handleFitViewClick}
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
					<PanelResizeHandle className="group relative w-2 bg-border/80 transition-colors data-[dragging]:bg-ring">
						<div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border group-data-[dragging]:bg-ring" />
					</PanelResizeHandle>
					<Panel defaultSize={70} minSize={24} className="min-w-0">
						<div className="flex h-full min-h-0 flex-col bg-background">
							<div className="flex h-10 items-center justify-between border-b border-border bg-muted/30 px-3 text-xs text-muted-foreground">
								<span>
									{isLoadingShare
										? "Loading shared schema"
										: isLayouting
											? "Running auto layout"
											: "Drag tables to arrange the schema"}
								</span>
								<span>{currentShareId ? `forkable snapshot /s/${currentShareId}` : "unsaved draft"}</span>
							</div>
							<div className="min-h-0 flex-1">
								<Canvas
									nodes={nodes}
									edges={edges}
									isBusy={isLoadingShare || isLayouting}
									onNodesChange={onNodesChange}
									onEdgesChange={onEdgesChange}
									onInit={(instance) => {
										reactFlowRef.current = instance;
									}}
								/>
							</div>
						</div>
					</Panel>
				</PanelGroup>
			</div>
		</div>
	);
}

export default App;
