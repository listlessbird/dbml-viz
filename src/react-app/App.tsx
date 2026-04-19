import { useEdgesState, useNodesState } from "@xyflow/react";
import {
	Group as PanelGroup,
	Panel,
	type PanelImperativeHandle,
} from "react-resizable-panels";
import {
	Suspense,
	lazy,
	startTransition,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { Canvas } from "@/components/Canvas";
import { Toolbar } from "@/components/Toolbar";
import { useCanvasViewport } from "@/hooks/useCanvasViewport";
import { useDiagramSearch } from "@/hooks/useDiagramSearch";
import { useDiagramSync } from "@/hooks/useDiagramSync";
import { useDraftPersistence } from "@/hooks/useDraftPersistence";
import { useRouting } from "@/hooks/useRouting";
import { useSchemaLoader } from "@/hooks/useSchemaLoader";
import { useSchemaParser } from "@/hooks/useSchemaParser";
import { useShareSchema } from "@/hooks/useShareSchema";
import {
	getDraftHydrationResult,
	getDiagramRouteState,
	getInitialDraftState,
	type DiagramRouteState,
} from "@/lib/draftPersistence";
import { SAMPLE_SCHEMA_SOURCE } from "@/lib/sample-dbml";
import { getDiagramDraft, useDiagramDraftStore } from "@/store/useDiagramDraftStore";
import { useDiagramUiStore } from "@/store/useDiagramUiStore";
import { useStickyNotesStore } from "@/store/useStickyNotesStore";
import type { DiagramEdge, DiagramNode, DiagramNodeSize } from "@/types";

interface InitialAppState {
	readonly route: DiagramRouteState;
	readonly draftState: ReturnType<typeof getInitialDraftState>;
	readonly isBlockingShareLoad: boolean;
}

type IdleWindow = Window &
	typeof globalThis & {
		requestIdleCallback?: (
			callback: (deadline: IdleDeadline) => void,
			options?: IdleRequestOptions,
		) => number;
		cancelIdleCallback?: (handle: number) => void;
	};

let editorModulePromise: Promise<typeof import("@/components/Editor")> | null = null;

const loadEditorModule = () => {
	if (editorModulePromise === null) {
		editorModulePromise = import("@/components/Editor");
	}

	return editorModulePromise;
};

const LazyEditor = lazy(async () => {
	const module = await loadEditorModule();
	return {
		default: module.Editor,
	};
});

const scheduleWindowIdleCallback = (callback: () => void) => {
	const idleWindow = window as IdleWindow;

	if (typeof idleWindow.requestIdleCallback === "function") {
		return idleWindow.requestIdleCallback(() => callback(), { timeout: 2000 });
	}

	return window.setTimeout(callback, 1200);
};

const cancelWindowIdleCallback = (handle: number) => {
	const idleWindow = window as IdleWindow;

	if (typeof idleWindow.cancelIdleCallback === "function") {
		idleWindow.cancelIdleCallback(handle);
		return;
	}

	window.clearTimeout(handle);
};

const EditorBootstrapShell = ({
	value,
	onChange,
	onHide,
	onActivate,
	isParsing,
}: {
	readonly value: string;
	readonly onChange: (value: string) => void;
	readonly onHide: () => void;
	readonly onActivate: () => void;
	readonly isParsing: boolean;
}) => (
	<div className="dark flex h-full min-h-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
		<div className="flex min-h-12 items-center justify-between border-b border-sidebar-border/80 px-3 text-xs text-muted-foreground">
			<span>{isParsing ? "Parsing schema…" : "Loading rich editor…"}</span>
			<button
				type="button"
				className="inline-flex min-h-8 items-center border border-sidebar-border/70 px-2.5 text-[11px] font-medium text-sidebar-foreground transition-[background-color,border-color,color] duration-200 ease-out hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring motion-reduce:transition-none"
				onClick={onHide}
			>
				Hide
			</button>
		</div>
		<div className="border-b border-sidebar-border/70 px-3 py-2 text-[11px] text-muted-foreground">
			Basic editing is available immediately. The full CodeMirror editor upgrades in the
			background.
		</div>
		<textarea
			value={value}
			spellCheck={false}
			className="min-h-0 flex-1 resize-none border-0 bg-sidebar px-4 py-3 font-mono text-[13px] leading-7 text-sidebar-foreground outline-none"
			onChange={(event) => onChange(event.target.value)}
			onPointerDown={onActivate}
			onFocus={onActivate}
		/>
	</div>
);

const getInitialAppState = (): InitialAppState => {
	const route = getDiagramRouteState(window.location.pathname, window.location.search);
	const draft = getDiagramDraft(route.shareId);
	const draftState = getInitialDraftState({
		route,
		draft,
		sampleSource: SAMPLE_SCHEMA_SOURCE,
	});
	const hydration = getDraftHydrationResult({
		route,
		draft,
		sampleSource: SAMPLE_SCHEMA_SOURCE,
	});

	return {
		route,
		draftState,
		isBlockingShareLoad: hydration.remoteLoadMode === "blocking",
	};
};

function App() {
	const [initialState] = useState(() => {
		const state = getInitialAppState();
		useStickyNotesStore.getState().hydrate(state.draftState.notes);
		return state;
	});
	const [isEditorHidden, setIsEditorHidden] = useState(false);
	const [isEditorReady, setIsEditorReady] = useState(false);

	const [nodes, setNodes, onNodesChange] = useNodesState<DiagramNode>([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState<DiagramEdge>([]);
	const editorPanelRef = useRef<PanelImperativeHandle | null>(null);
	const {
		viewedRoute,
		setShareBaseline,
		currentShareBaseline,
		replaceViewedRoute,
		pushViewedRoute,
	} = useRouting(initialState.route);
	const {
		viewportZoom,
		requestFitView,
		handleCanvasInit,
		handleViewportChange,
		handleZoomIn,
		handleZoomOut,
	} = useCanvasViewport();
	const gridMode = useDiagramUiStore((state) => state.gridMode);
	const layoutAlgorithm = useDiagramUiStore((state) => state.layoutAlgorithm);
	const searchQuery = useDiagramUiStore((state) => state.searchQuery);
	const focusedTableIds = useDiagramUiStore((state) => state.focusedTableIds);
	const getDraft = useDiagramDraftStore((state) => state.getDraft);
	const setDraft = useDiagramDraftStore((state) => state.setDraft);
	const clearDraft = useDiagramDraftStore((state) => state.clearDraft);
	const {
		source,
		setSource,
		shareSeedPositions,
		setShareSeedPositions,
		isLoadingShare,
		shareLoadError,
		setShareLoadError,
		nodeMeasurements,
		pruneNodeMeasurements,
		recordNodeMeasurement,
	} = useSchemaLoader({
		initialSource: initialState.draftState.source,
		initialPositions: initialState.draftState.positions,
		initialIsLoading: initialState.isBlockingShareLoad,
		viewedRoute,
		currentShareBaseline,
		getDraft,
		clearDraft,
		setShareBaseline,
		replaceViewedRoute,
		requestFitView,
		setNodes,
		setEdges,
	});
	const { parsed, diagnostics, isParsing, metadata } = useSchemaParser(source);
	const { searchState, matchedTableNames, searchFocusIds } = useDiagramSearch(
		parsed,
		searchQuery,
	);
	const availableTableIds = useMemo(
		() => new Set(parsed.tables.map((table) => table.id)),
		[parsed.tables],
	);
	const activeFocusedTableIds = useMemo(
		() => focusedTableIds.filter((tableId) => availableTableIds.has(tableId)),
		[availableTableIds, focusedTableIds],
	);
	const fitViewTargetIds =
		activeFocusedTableIds.length > 0 ? activeFocusedTableIds : searchFocusIds;

	useEffect(() => {
		const editorPanel = editorPanelRef.current;
		if (!editorPanel) {
			return;
		}

		if (isEditorHidden) {
			editorPanel.collapse();
			return;
		}

		editorPanel.expand();
	}, [isEditorHidden]);

	const bootstrapEditor = useCallback(() => {
		if (isEditorReady) {
			return;
		}

		void loadEditorModule().then(() => {
			startTransition(() => {
				setIsEditorReady(true);
			});
		});
	}, [isEditorReady]);

	useEffect(() => {
		let cancelled = false;
		const idleHandle = scheduleWindowIdleCallback(() => {
			void loadEditorModule().then(() => {
				if (cancelled) {
					return;
				}

				startTransition(() => {
					setIsEditorReady(true);
				});
			});
		});

		return () => {
			cancelled = true;
			cancelWindowIdleCallback(idleHandle);
		};
	}, []);

	const handleMeasure = useCallback(
		(nodeId: string, size: DiagramNodeSize) => {
			recordNodeMeasurement(nodeId, size);
		},
		[recordNodeMeasurement],
	);

	const { isLayouting, applyAutoLayout } = useDiagramSync({
		parsed,
		searchState,
		shareSeedPositions,
		nodeMeasurements,
		pruneNodeMeasurements,
		layoutAlgorithm,
		focusIds: fitViewTargetIds,
		nodes,
		handleMeasure,
		requestFitView,
		setNodes,
		setEdges,
	});

	useEffect(() => {
		if (searchFocusIds.length === 0) {
			return;
		}

		requestFitView(searchFocusIds);
	}, [requestFitView, searchFocusIds]);

	useDraftPersistence({
		source,
		nodes,
		shareSeedPositions,
		isLoadingShare,
		viewedRoute,
		currentShareBaseline,
		clearDraft,
		setDraft,
		replaceViewedRoute,
	});

	const { isSharing, handleShare } = useShareSchema({
		source,
		nodes,
		shareSeedPositions,
		viewedRoute,
		clearDraft,
		pushViewedRoute,
		setShareSeedPositions,
		setShareBaseline,
		setShareLoadError,
	});

	const handleAutoLayoutClick = useCallback(() => {
		void applyAutoLayout({ fitView: true });
	}, [applyAutoLayout]);

	const handleFitViewClick = useCallback(() => {
		requestFitView(fitViewTargetIds.length > 0 ? fitViewTargetIds : undefined);
	}, [fitViewTargetIds, requestFitView]);

	const handleToggleEditor = useCallback(() => {
		setIsEditorHidden((currentValue) => !currentValue);
	}, []);

	const handleShowEditor = useCallback(() => {
		setIsEditorHidden(false);
		bootstrapEditor();
	}, [bootstrapEditor]);

	return (
		<div className="h-screen bg-background text-foreground">
			<div className="flex h-full flex-col">
				<Toolbar
					tableCount={parsed.tables.length}
					relationCount={parsed.refs.length}
					isSharing={isSharing}
					shareId={viewedRoute.shareId}
					isDirty={viewedRoute.isDirty}
					onShare={handleShare}
				/>

				{shareLoadError ? (
					<div className="flex items-center gap-3 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
						<span className="flex-1">Shared schema unavailable. {shareLoadError}</span>
						<button
							type="button"
							className="shrink-0 opacity-60 transition-opacity hover:opacity-100"
							aria-label="Dismiss error"
							onClick={() => setShareLoadError(null)}
						>
							&times;
						</button>
					</div>
				) : null}

				<PanelGroup orientation="horizontal" className="min-h-0 flex-1">
					<Panel
						panelRef={editorPanelRef}
						defaultSize={30}
						minSize={18}
						collapsible
						collapsedSize={0}
						className="min-w-0"
					>
						{isEditorReady ? (
							<Suspense
								fallback={
									<EditorBootstrapShell
										value={source}
										onChange={setSource}
										onHide={handleToggleEditor}
										onActivate={bootstrapEditor}
										isParsing={isParsing}
									/>
								}
							>
								<LazyEditor
									value={source}
									diagnostics={diagnostics}
									isParsing={isParsing}
									sourceMetadata={metadata}
									onChange={setSource}
									onHide={handleToggleEditor}
								/>
							</Suspense>
						) : (
							<EditorBootstrapShell
								value={source}
								onChange={setSource}
								onHide={handleToggleEditor}
								onActivate={bootstrapEditor}
								isParsing={isParsing}
							/>
						)}
					</Panel>
					<Panel defaultSize={70} minSize={24} className="min-w-0">
						<div className="h-full min-h-0 bg-background">
							<Canvas
								nodes={nodes}
								edges={edges}
								gridMode={gridMode}
								isBusy={isLoadingShare || isLayouting}
								isLayouting={isLayouting}
								isEditorHidden={isEditorHidden}
								matchedTableNames={matchedTableNames}
								zoom={viewportZoom}
								onAutoLayout={handleAutoLayoutClick}
								onNodesChange={onNodesChange}
								onEdgesChange={onEdgesChange}
								onFitView={handleFitViewClick}
								onInit={handleCanvasInit}
								onShowEditor={handleShowEditor}
								onViewportChange={handleViewportChange}
								onZoomIn={handleZoomIn}
								onZoomOut={handleZoomOut}
							/>
						</div>
					</Panel>
				</PanelGroup>
			</div>
		</div>
	);
}

export default App;
