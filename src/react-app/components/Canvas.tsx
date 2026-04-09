import {
  IconFocus2,
  IconHandMove,
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

import { CanvasDock } from "@/components/CanvasDock";
import { RelationshipEdge } from "@/components/RelationshipEdge";
import { TableNode } from "@/components/TableNode";
import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import { useRelationHighlighting } from "@/hooks/useRelationHighlighting";
import { cn } from "@/lib/utils";
import { useDiagramUiStore } from "@/store/useDiagramUiStore";
import type { DiagramEdge, DiagramGridMode, DiagramNode } from "@/types";

const nodeTypes: NodeTypes = { table: TableNode };
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
  readonly matchedTableNames: readonly string[];
  readonly zoom: number;
  readonly onAutoLayout: () => void;
  readonly onNodesChange: (changes: NodeChange<DiagramNode>[]) => void;
  readonly onEdgesChange: (changes: EdgeChange<DiagramEdge>[]) => void;
  readonly onFitView: () => void;
  readonly onInit: (
    instance: ReactFlowInstance<DiagramNode, DiagramEdge>,
  ) => void;
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
  matchedTableNames,
  zoom,
  onAutoLayout,
  onNodesChange,
  onEdgesChange,
  onFitView,
  onInit,
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

  return (
    <div
      className="relative h-full min-h-0 overflow-hidden bg-background"
      onFocusCapture={handlers.onFocusCapture}
      onBlurCapture={handlers.onBlurCapture}
    >
      <ReactFlow<DiagramNode, DiagramEdge>
        className={isPanModeEnabled ? "canvas-pan-mode" : undefined}
        nodes={displayNodes}
        edges={displayEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onInit={onInit}
        onViewportChange={onViewportChange}
        onNodeMouseEnter={handlers.onNodeMouseEnter}
        onNodeMouseLeave={handlers.onNodeMouseLeave}
        onSelectionChange={handlers.onSelectionChange}
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
