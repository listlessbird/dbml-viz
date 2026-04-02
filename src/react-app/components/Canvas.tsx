import {
	Background,
	BackgroundVariant,
	Controls,
	MiniMap,
	type EdgeTypes,
	type NodeTypes,
	ReactFlow,
	type EdgeChange,
	type NodeChange,
	type ReactFlowInstance,
} from "@xyflow/react";

import { RelationshipEdge } from "@/components/RelationshipEdge";
import { TableNode } from "@/components/TableNode";
import type { DiagramEdge, DiagramNode } from "@/types";

const nodeTypes: NodeTypes = {
	table: TableNode,
};

const edgeTypes: EdgeTypes = {
	relationship: RelationshipEdge,
};

interface CanvasProps {
	readonly nodes: DiagramNode[];
	readonly edges: DiagramEdge[];
	readonly isBusy: boolean;
	readonly onNodesChange: (changes: NodeChange<DiagramNode>[]) => void;
	readonly onEdgesChange: (changes: EdgeChange<DiagramEdge>[]) => void;
	readonly onInit: (instance: ReactFlowInstance<DiagramNode, DiagramEdge>) => void;
}

export function Canvas({
	nodes,
	edges,
	isBusy,
	onNodesChange,
	onEdgesChange,
	onInit,
}: CanvasProps) {
	return (
		<div className="relative h-full min-h-0 overflow-hidden bg-background">
			<ReactFlow<DiagramNode, DiagramEdge>
				nodes={nodes}
				edges={edges}
				nodeTypes={nodeTypes}
				edgeTypes={edgeTypes}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onInit={onInit}
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
				<Background
					variant={BackgroundVariant.Dots}
					gap={24}
					size={1}
					color="var(--border)"
				/>
				<Controls
					position="bottom-right"
					showInteractive={false}
					className="!rounded-none !border !border-border !bg-background"
				/>
				<MiniMap
					position="bottom-left"
					pannable
					zoomable
					className="!rounded-none !border !border-border !bg-background"
					maskColor="var(--muted)"
					nodeColor={() => "var(--primary)"}
				/>
			</ReactFlow>

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
