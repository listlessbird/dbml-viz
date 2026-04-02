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
import { useMemo, useState } from "react";

import { CanvasDock } from "@/components/CanvasDock";
import { RelationshipEdge } from "@/components/RelationshipEdge";
import { TableNode } from "@/components/TableNode";
import type { DiagramEdge, DiagramGridMode, DiagramNode } from "@/types";

const nodeTypes: NodeTypes = {
	table: TableNode,
};

const edgeTypes: EdgeTypes = {
	relationship: RelationshipEdge,
};

const EDGE_TRANSITION_EASING = "cubic-bezier(0.215, 0.61, 0.355, 1)";
const EDGE_TRANSITION = [
	`opacity 180ms ${EDGE_TRANSITION_EASING}`,
	`stroke-width 180ms ${EDGE_TRANSITION_EASING}`,
].join(", ");

const getNodeIdFromEventTarget = (target: EventTarget | null) =>
	target instanceof HTMLElement
		? target.closest<HTMLElement>(".react-flow__node[data-id]")?.dataset.id ?? null
		: null;

const toNumber = (value: number | string | undefined, fallback: number) => {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === "string") {
		const parsed = Number(value);
		if (Number.isFinite(parsed)) {
			return parsed;
		}
	}

	return fallback;
};

const sameIds = (left: readonly string[], right: readonly string[]) =>
	left.length === right.length && left.every((value, index) => value === right[index]);

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
	const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
	const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
	const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

	const availableNodeIds = useMemo(
		() => new Set(nodes.map((node) => node.id)),
		[nodes],
	);
	const activeSelectedNodeIds = useMemo(
		() => selectedNodeIds.filter((nodeId) => availableNodeIds.has(nodeId)),
		[availableNodeIds, selectedNodeIds],
	);
	const activeHoveredNodeId =
		hoveredNodeId !== null && availableNodeIds.has(hoveredNodeId)
			? hoveredNodeId
			: null;
	const activeFocusedNodeId =
		focusedNodeId !== null && availableNodeIds.has(focusedNodeId)
			? focusedNodeId
			: null;

	const activeTableIds = useMemo(() => {
		const ids = new Set(activeSelectedNodeIds);

		if (activeHoveredNodeId !== null) {
			ids.add(activeHoveredNodeId);
		}

		if (activeFocusedNodeId !== null) {
			ids.add(activeFocusedNodeId);
		}

		return ids;
	}, [activeFocusedNodeId, activeHoveredNodeId, activeSelectedNodeIds]);

	const activeRelationColumnsByTable = useMemo(() => {
		const columnsByTable = new Map<string, Set<string>>();

		for (const edge of edges) {
			if (
				edge.data === undefined ||
				(!activeTableIds.has(edge.source) && !activeTableIds.has(edge.target))
			) {
				continue;
			}

			const sourceColumns = columnsByTable.get(edge.data.from.table) ?? new Set<string>();
			sourceColumns.add(edge.data.from.column);
			columnsByTable.set(edge.data.from.table, sourceColumns);

			const targetColumns = columnsByTable.get(edge.data.to.table) ?? new Set<string>();
			targetColumns.add(edge.data.to.column);
			columnsByTable.set(edge.data.to.table, targetColumns);
		}

		return columnsByTable;
	}, [activeTableIds, edges]);

	const displayNodes = useMemo(
		() =>
			nodes.map((node) => {
				const activeRelationColumns = Array.from(
					activeRelationColumnsByTable.get(node.id) ?? [],
				);

				return {
					...node,
					data: {
						...node.data,
						activeRelationColumns,
						isRelationContextActive: activeRelationColumns.length > 0,
					},
				} satisfies DiagramNode;
			}),
		[activeRelationColumnsByTable, nodes],
	);

	const displayEdges = useMemo(
		() =>
			edges.map((edge) => {
				if (edge.data === undefined) {
					return edge;
				}

				const isRelationSourceActive = activeTableIds.has(edge.source);
				const isRelationTargetActive = activeTableIds.has(edge.target);
				const isRelationActive = isRelationSourceActive || isRelationTargetActive;
				const baseStrokeWidth = toNumber(edge.style?.strokeWidth, 1.4);
				const stroke = isRelationActive
					? "var(--primary)"
					: typeof edge.style?.stroke === "string"
						? edge.style.stroke
						: "var(--primary)";

				return {
					...edge,
					data: {
						...edge.data,
						isRelationActive,
						isRelationSourceActive,
						isRelationTargetActive,
					},
					style: {
						...edge.style,
						stroke,
						strokeWidth: isRelationActive ? baseStrokeWidth + 0.9 : baseStrokeWidth,
						opacity: toNumber(edge.style?.opacity, 1),
						transition: EDGE_TRANSITION,
					},
					markerEnd:
						edge.markerEnd && typeof edge.markerEnd === "object"
							? {
									...edge.markerEnd,
									color: stroke,
								}
							: edge.markerEnd,
				} satisfies DiagramEdge;
			}),
		[activeTableIds, edges],
	);

	return (
		<div
			className="relative h-full min-h-0 overflow-hidden bg-background"
			onFocusCapture={(event) => {
				const nodeId = getNodeIdFromEventTarget(event.target);
				if (nodeId !== null) {
					setFocusedNodeId((current) => (current === nodeId ? current : nodeId));
				}
			}}
			onBlurCapture={(event) => {
				const currentNodeId = getNodeIdFromEventTarget(event.target);
				if (currentNodeId === null) {
					return;
				}

				const nextFocusedNodeId = getNodeIdFromEventTarget(event.relatedTarget);
				setFocusedNodeId((current) =>
					current === nextFocusedNodeId ? current : nextFocusedNodeId,
				);
			}}
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
				onNodeMouseEnter={(_, node) => {
					setHoveredNodeId((current) => (current === node.id ? current : node.id));
				}}
				onNodeMouseLeave={(_, node) => {
					setHoveredNodeId((current) => (current === node.id ? null : current));
				}}
				onSelectionChange={({ nodes: selectedNodes }) => {
					const nextSelectedNodeIds = selectedNodes
						.map((node) => node.id)
						.sort();

					setSelectedNodeIds((current) =>
						sameIds(current, nextSelectedNodeIds)
							? current
							: nextSelectedNodeIds,
					);
				}}
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
						gap={gridMode === "lines" ? 32 : 24}
						size={gridMode === "lines" ? 1 : 1.6}
						color={
							gridMode === "lines"
								? "color-mix(in oklab, var(--foreground) 8%, var(--background))"
								: "color-mix(in oklab, var(--foreground) 18%, var(--background))"
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
