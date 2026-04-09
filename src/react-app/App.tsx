import { useEdgesState, useNodesState } from "@xyflow/react";
import {
	Group as PanelGroup,
	Panel,
	type PanelImperativeHandle,
} from "react-resizable-panels";
import { useCallback, useEffect, useRef, useState } from "react";

import { Canvas } from "@/components/Canvas";
import { Editor } from "@/components/Editor";
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
import type { DiagramEdge, DiagramNode, DiagramNodeSize } from "@/types";

interface InitialAppState {
	readonly route: DiagramRouteState;
	readonly draftState: ReturnType<typeof getInitialDraftState>;
	readonly isBlockingShareLoad: boolean;
}

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
	const [initialState] = useState(getInitialAppState);
	const [isEditorHidden, setIsEditorHidden] = useState(false);

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
	const { parsed, diagnostics, isParsing } = useSchemaParser(source);
	const { searchState, matchedTableNames, searchFocusIds } = useDiagramSearch(
		parsed,
		searchQuery,
	);
	const fitViewTargetIds =
		focusedTableIds.length > 0 ? focusedTableIds : searchFocusIds;
	const nodesRef = useRef<DiagramNode[]>([]);

	useEffect(() => {
		nodesRef.current = nodes;
	}, [nodes]);

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
		layoutAlgorithm,
		focusIds: fitViewTargetIds,
		nodesRef,
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
		nodesRef,
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
	}, []);

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
						<Editor
							value={source}
							diagnostics={diagnostics}
							isParsing={isParsing}
							onChange={setSource}
							onHide={handleToggleEditor}
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
