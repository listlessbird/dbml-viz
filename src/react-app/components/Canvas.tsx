import { IconFocus2, IconMinus, IconPlus } from "@tabler/icons-react";
import {
	Background,
	BackgroundVariant,
	MiniMap,
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
import { useRelationHighlighting } from "@/hooks/useRelationHighlighting";
import type { DiagramEdge, DiagramGridMode, DiagramNode } from "@/types";

const nodeTypes: NodeTypes = { table: TableNode };
const edgeTypes: EdgeTypes = { relationship: RelationshipEdge };

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
	readonly onInit: (instance: ReactFlowInstance<DiagramNode, DiagramEdge>) => void;
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
	const { displayNodes, displayEdges, handlers } = useRelationHighlighting(nodes, edges);

	return (
		<div
			className="relative h-full min-h-0 overflow-hidden bg-background"
			onFocusCapture={handlers.onFocusCapture}
			onBlurCapture={handlers.onBlurCapture}
		>
			<ReactFlow<DiagramNode, DiagramEdge>
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
				minZoom={0.25}
				maxZoom={1.8}
				proOptions={{ hideAttribution: true }}
				fitViewOptions={{ padding: 0.2 }}
				defaultEdgeOptions={{
					type: "smoothstep",
					animated: false,
				}}
			>
				{gridMode === "none" ? null : (
					<Background
						variant={
							gridMode === "lines"
								? BackgroundVariant.Lines
								: BackgroundVariant.Dots
						}
						gap={gridMode === "lines" ? 48 : 36}
						size={gridMode === "lines" ? 1 : 2}
						color={
							gridMode === "lines"
								? "color-mix(in oklab, var(--foreground) 6%, var(--background))"
								: "color-mix(in oklab, var(--foreground) 14%, var(--background))"
						}
					/>
				)}
				{nodes.length > 0 ? (
					<MiniMap
						position="bottom-right"
						pannable
						zoomable
						className="!rounded-none !border !border-border !bg-background"
						maskColor="color-mix(in oklab, var(--muted) 84%, transparent)"
						nodeColor={() => "var(--primary)"}
					/>
				) : null}
			</ReactFlow>

			<div className="pointer-events-none absolute bottom-4 left-4 z-10">
				<div className="pointer-events-auto inline-flex items-stretch overflow-hidden border border-border bg-background/96 text-foreground shadow-[0_18px_38px_color-mix(in_oklab,var(--foreground)_12%,transparent)] backdrop-blur-sm">
					<button
						type="button"
						title="Zoom out"
						className="inline-flex h-10 w-10 items-center justify-center border-r border-border transition-colors hover:bg-muted"
						onClick={onZoomOut}
					>
						<IconMinus className="size-4" />
					</button>
					<div className="inline-flex min-w-16 items-center justify-center px-3 text-sm text-muted-foreground">
						{Math.round(zoom * 100)}%
					</div>
					<button
						type="button"
						title="Zoom in"
						className="inline-flex h-10 w-10 items-center justify-center border-l border-border transition-colors hover:bg-muted"
						onClick={onZoomIn}
					>
						<IconPlus className="size-4" />
					</button>
					<button
						type="button"
						title="Fit view"
						className="inline-flex h-10 w-10 items-center justify-center border-l border-border transition-colors hover:bg-muted"
						onClick={onFitView}
					>
						<IconFocus2 className="size-4" />
					</button>
				</div>
			</div>

			<CanvasDock
				isLayouting={isLayouting}
				matchedTableNames={matchedTableNames}
				onAutoLayout={onAutoLayout}
			/>

			{nodes.length === 0 ? (
				<div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
					<div className="max-w-sm text-center">
						<p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
							Canvas
						</p>
						<h2 className="mt-2 text-lg font-medium tracking-tight text-foreground">
							Start typing DBML to render your schema.
						</h2>
						<p className="mt-2 text-sm leading-6 text-muted-foreground">
							Tables and relationships will appear here. Drag them to arrange the
							layout, then share the snapshot when it is ready.
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
