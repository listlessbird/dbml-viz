import {
  IconFocus2,
  IconHandMove,
  IconLayoutSidebarLeftExpand,
  IconMinus,
  IconPlus,
} from "@tabler/icons-react";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  PanOnScrollMode,
  SelectionMode,
  type BackgroundProps,
  type EdgeChange,
  type EdgeTypes,
  type NodeChange,
  type NodeTypes,
  type ReactFlowInstance,
  type Viewport,
  ReactFlow,
} from "@xyflow/react";
import { useCallback, useMemo, useRef } from "react";

import { CanvasDock } from "@/components/CanvasDock";
import { RelationshipEdge } from "@/components/RelationshipEdge";
import { StickyNoteNode, STICKY_NOTE_DRAG_HANDLE } from "@/components/StickyNoteNode";
import { TableNode } from "@/components/TableNode";
import { useStickyNotesStore } from "@/store/useStickyNotesStore";
import type { CanvasNode, StickyNoteNode as StickyNoteNodeType } from "@/types";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { useRelationHighlighting } from "@/hooks/useRelationHighlighting";
import { cn } from "@/lib/utils";
import { useDiagramUiStore } from "@/store/useDiagramUiStore";
import type { DiagramEdge, DiagramGridMode, DiagramNode } from "@/types";

const nodeTypes: NodeTypes = { table: TableNode, sticky: StickyNoteNode };
const EMPTY_STICKY_DATA = Object.freeze({}) as Record<string, never>;
const STICKY_DRAG_HANDLE_SELECTOR = `.${STICKY_NOTE_DRAG_HANDLE}`;

const stickyNodeCache = new WeakMap<object, StickyNoteNodeType>();

const recordToNode = (
	record: import("@/store/useStickyNotesStore").StickyNoteRecord,
): StickyNoteNodeType => {
	const cached = stickyNodeCache.get(record);
	if (cached) return cached;
	const node: StickyNoteNodeType = {
		id: record.id,
		type: "sticky",
		position: record.position,
		selected: record.selected,
		dragHandle: STICKY_DRAG_HANDLE_SELECTOR,
		width: record.width,
		height: record.height,
		data: EMPTY_STICKY_DATA,
	};
	stickyNodeCache.set(record, node);
	return node;
};
const edgeTypes: EdgeTypes = { relationship: RelationshipEdge };
type GridPattern = Pick<
  BackgroundProps,
  "variant" | "gap" | "size" | "lineWidth" | "color"
>;

const GRID_PATTERNS: Record<Exclude<DiagramGridMode, "none">, GridPattern> = {
  dots: {
    variant: BackgroundVariant.Dots,
    gap: 20,
    size: 1.9,
    color: "color-mix(in oklab, var(--foreground) 11%, var(--background))",
  },
  lines: {
    variant: BackgroundVariant.Lines,
    gap: 32,
    lineWidth: 1.35,
    color: "color-mix(in oklab, var(--foreground) 6%, var(--background))",
  },
};

interface CanvasProps {
  readonly nodes: DiagramNode[];
  readonly edges: DiagramEdge[];
  readonly gridMode: DiagramGridMode;
  readonly isBusy: boolean;
  readonly isLayouting: boolean;
  readonly isEditorHidden: boolean;
  readonly matchedTableNames: readonly string[];
  readonly zoom: number;
  readonly onAutoLayout: () => void;
  readonly onNodesChange: (changes: NodeChange<DiagramNode>[]) => void;
  readonly onEdgesChange: (changes: EdgeChange<DiagramEdge>[]) => void;
  readonly onFitView: () => void;
  readonly onInit: (
    instance: ReactFlowInstance<DiagramNode, DiagramEdge>,
  ) => void;
  readonly onShowEditor: () => void;
  readonly onShowEditorHover?: () => void;
  readonly onViewportChange: (viewport: Viewport) => void;
  readonly onZoomIn: () => void;
  readonly onZoomOut: () => void;
}

export function Canvas({
  nodes,
  edges,
  gridMode,
  isBusy,
  isLayouting,
  isEditorHidden,
  matchedTableNames,
  zoom,
  onAutoLayout,
  onNodesChange,
  onEdgesChange,
  onFitView,
  onInit,
  onShowEditor,
  onShowEditorHover,
  onViewportChange,
  onZoomIn,
  onZoomOut,
}: CanvasProps) {
  const { displayNodes, displayEdges, handlers } = useRelationHighlighting(
    nodes,
    edges,
  );
  const hasDiagram = nodes.length > 0;
  const isPanModeEnabled = useDiagramUiStore((state) => state.panModeEnabled);
  const togglePanMode = useDiagramUiStore((state) => state.togglePanMode);

  const stickyNotes = useStickyNotesStore((state) => state.notes);
  const instanceRef = useRef<ReactFlowInstance<CanvasNode, DiagramEdge> | null>(
    null,
  );

  const stickyNoteNodes = useMemo<StickyNoteNodeType[]>(
    () => stickyNotes.map(recordToNode),
    [stickyNotes],
  );

  const mergedNodes = useMemo<CanvasNode[]>(
    () => [...stickyNoteNodes, ...displayNodes],
    [displayNodes, stickyNoteNodes],
  );

  const handleInit = useCallback(
    (instance: ReactFlowInstance<CanvasNode, DiagramEdge>) => {
      instanceRef.current = instance;
      onInit(instance as unknown as ReactFlowInstance<DiagramNode, DiagramEdge>);
    },
    [onInit],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange<CanvasNode>[]) => {
      const stickyIds = new Set(
        useStickyNotesStore.getState().notes.map((note) => note.id),
      );
      const stickyChanges: NodeChange[] = [];
      const tableChanges: NodeChange<DiagramNode>[] = [];

      for (const change of changes) {
        const changeId = "id" in change ? change.id : undefined;
        if (changeId && stickyIds.has(changeId)) {
          stickyChanges.push(change as NodeChange);
        } else {
          tableChanges.push(change as NodeChange<DiagramNode>);
        }
      }

      if (stickyChanges.length > 0) {
        useStickyNotesStore.getState().applyChanges(stickyChanges);
      }
      if (tableChanges.length > 0) {
        onNodesChange(tableChanges);
      }
    },
    [onNodesChange],
  );

  const handleAddStickyNote = useCallback(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    const center = instance.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    useStickyNotesStore.getState().addNote(center);
  }, []);

  return (
    <div
      className="relative h-full min-h-0 overflow-hidden bg-background"
      onFocusCapture={handlers.onFocusCapture}
      onBlurCapture={handlers.onBlurCapture}
    >
      <ReactFlow<CanvasNode, DiagramEdge>
        className={isPanModeEnabled ? "canvas-pan-mode" : undefined}
        nodes={mergedNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={handleInit}
        onViewportChange={onViewportChange}
        onNodeMouseEnter={(event, node) => {
          if (node.type === "table") {
            handlers.onNodeMouseEnter(event, node as DiagramNode);
          }
        }}
        onNodeMouseLeave={(event, node) => {
          if (node.type === "table") {
            handlers.onNodeMouseLeave(event, node as DiagramNode);
          }
        }}
        onSelectionChange={({ nodes: selectedNodes }) => {
          handlers.onSelectionChange({
            nodes: selectedNodes.filter(
              (node): node is DiagramNode => node.type === "table",
            ),
          });
        }}
        nodesConnectable={false}
        panOnDrag={isPanModeEnabled}
        panOnScroll
        panOnScrollMode={PanOnScrollMode.Free}
        selectionOnDrag={!isPanModeEnabled}
        selectionMode={SelectionMode.Partial}
        minZoom={0.25}
        maxZoom={1.8}
        zoomOnScroll={false}
        proOptions={{ hideAttribution: true }}
        fitViewOptions={{ padding: 0.2 }}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: false,
        }}
      >
        {gridMode === "none" ? null : (
          <Background {...GRID_PATTERNS[gridMode]} />
        )}
        <MiniMap
          position="bottom-right"
          pannable={hasDiagram}
          zoomable={hasDiagram}
          className={cn(
            "rounded-none! border! border-border! bg-background! transition-[opacity,transform]! duration-200! ease-out!",
            hasDiagram
              ? "translate-y-0! opacity-100!"
              : "pointer-events-none! translate-y-2! opacity-0!",
          )}
          maskColor="color-mix(in oklab, var(--muted) 84%, transparent)"
          nodeColor={() => "var(--primary)"}
        />
      </ReactFlow>

      <div
        className={cn(
          "pointer-events-none absolute left-4 top-4 z-10 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
          isEditorHidden ? "translate-x-0 opacity-100" : "-translate-x-3 opacity-0",
        )}
      >
        <button
          type="button"
          tabIndex={isEditorHidden ? 0 : -1}
          aria-hidden={!isEditorHidden}
          className="pointer-events-auto inline-flex min-h-9 items-center gap-2 border border-border/80 bg-background/96 px-3 text-xs font-medium text-foreground shadow-[0_16px_32px_color-mix(in_oklab,var(--foreground)_12%,transparent)] transition-[background-color,border-color,color,transform] duration-200 ease-out hover:-translate-y-px hover:border-border hover:bg-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          onClick={onShowEditor}
          onMouseEnter={onShowEditorHover}
          onFocus={onShowEditorHover}
        >
          <IconLayoutSidebarLeftExpand className="size-4 text-primary" />
        </button>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 z-10">
        <div className="pointer-events-auto overflow-hidden bg-background/96 text-foreground shadow-[0_18px_38px_color-mix(in_oklab,var(--foreground)_12%,transparent)] backdrop-blur-sm">
          <ButtonGroup className="overflow-hidden">
            <Button
              type="button"
              title="Zoom out"
              aria-label="Zoom out"
              variant="outline"
              size="icon-lg"
              onClick={onZoomOut}
            >
              <IconMinus className="size-4" />
            </Button>
            <ButtonGroupText className="min-w-16 justify-center border-border bg-background/96 px-3 text-sm text-muted-foreground">
              {Math.round(zoom * 100)}%
            </ButtonGroupText>
            <Button
              type="button"
              title="Zoom in"
              aria-label="Zoom in"
              variant="outline"
              size="icon-lg"
              onClick={onZoomIn}
            >
              <IconPlus className="size-4" />
            </Button>
            <Button
              type="button"
              title="Fit view"
              aria-label="Fit view"
              variant="outline"
              size="icon-lg"
              onClick={onFitView}
            >
              <IconFocus2 className="size-4" />
            </Button>
            <Button
              type="button"
              title={
                isPanModeEnabled
                  ? "Pan mode is on. Left-drag pans until you turn it off."
                  : "Pan mode is off. Drag on the canvas to select tables."
              }
              aria-label="Toggle pan mode"
              aria-pressed={isPanModeEnabled}
              variant={isPanModeEnabled ? "default" : "outline"}
              size="icon-lg"
              onClick={togglePanMode}
            >
              <IconHandMove className="size-4" />
            </Button>
          </ButtonGroup>
        </div>
      </div>

      <CanvasDock
        isLayouting={isLayouting}
        matchedTableNames={matchedTableNames}
        onAutoLayout={onAutoLayout}
        onFitView={onFitView}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onAddStickyNote={handleAddStickyNote}
      />

      {!hasDiagram ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="max-w-sm text-center">
            <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
              Dbml Viz
            </p>
            <h2 className="mt-2 text-lg font-medium tracking-tight text-foreground">
              Supports dbml/sql
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Tables and relationships will appear here. Drag them to arrange
              the layout, then share the snapshot when it is ready.
            </p>
          </div>
        </div>
      ) : null}

      {isBusy ? (
        <div className="pointer-events-none absolute right-4 top-4 border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
          Updating diagram…
        </div>
      ) : null}
    </div>
  );
}
