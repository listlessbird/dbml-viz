import { useEdgesState, useNodesState } from "@xyflow/react";
import { Group as PanelGroup, Panel } from "react-resizable-panels";
import { useCallback, useEffect, useRef, useState } from "react";

import { Canvas } from "@/components/Canvas";
import { Editor } from "@/components/Editor";
import { Toolbar } from "@/components/Toolbar";
import { useCanvasViewport } from "@/hooks/useCanvasViewport";
import { useDiagramSearch } from "@/hooks/useDiagramSearch";
import { useDiagramSync } from "@/hooks/useDiagramSync";
import { useDbmlParser } from "@/hooks/useDbmlParser";
import { useDraftPersistence } from "@/hooks/useDraftPersistence";
import { useRouting } from "@/hooks/useRouting";
import { useSchemaLoader } from "@/hooks/useSchemaLoader";
import { useShareSchema } from "@/hooks/useShareSchema";
import {
	createDiagramRouteHref,
	getDraftHydrationResult,
	getDiagramRouteState,
	getInitialDraftState,
	type DiagramRouteState,
} from "@/lib/draftPersistence";
import { SAMPLE_DBML } from "@/lib/sample-dbml";
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
		sampleDbml: SAMPLE_DBML,
	});
	const hydration = getDraftHydrationResult({
		route,
		draft,
		sampleDbml: SAMPLE_DBML,
	});

	return {
		route,
		draftState,
		isBlockingShareLoad: hydration.remoteLoadMode === "blocking",
	};
};

function App() {
	const [initialState] = useState(getInitialAppState);

	const [nodes, setNodes, onNodesChange] = useNodesState<DiagramNode>([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState<DiagramEdge>([]);
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
	const getDraft = useDiagramDraftStore((state) => state.getDraft);
	const setDraft = useDiagramDraftStore((state) => state.setDraft);
	const clearDraft = useDiagramDraftStore((state) => state.clearDraft);
	const {
		dbml,
		setDbml,
		shareSeedPositions,
		setShareSeedPositions,
		isLoadingShare,
		shareLoadError,
		setShareLoadError,
		nodeMeasurements,
		recordNodeMeasurement,
	} = useSchemaLoader({
		initialDbml: initialState.draftState.dbml,
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
	const { parsed, diagnostics, isParsing } = useDbmlParser(dbml);
	const { searchState, matchedTableNames, searchFocusIds } = useDiagramSearch(
		parsed,
		searchQuery,
	);
	const nodesRef = useRef<DiagramNode[]>([]);

	useEffect(() => {
		nodesRef.current = nodes;
	}, [nodes]);

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
		searchFocusIds,
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
		dbml,
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
		dbml,
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
		requestFitView(searchFocusIds.length > 0 ? searchFocusIds : undefined);
	}, [requestFitView, searchFocusIds]);

	const routeLabel =
		viewedRoute.shareId === null ? "draft" : createDiagramRouteHref(viewedRoute);

	return (
		<div className="h-screen bg-background text-foreground">
			<div className="flex h-full flex-col">
				<Toolbar
					tableCount={parsed.tables.length}
					relationCount={parsed.refs.length}
					isSharing={isSharing}
					routeLabel={routeLabel}
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
								onInit={handleCanvasInit}
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
