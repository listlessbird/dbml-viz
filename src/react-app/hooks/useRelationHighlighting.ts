import { useCallback, useMemo, useState } from "react";
import type { FocusEvent, MouseEvent } from "react";

import { useDiagramUiStore } from "@/store/useDiagramUiStore";
import type { DiagramEdge, DiagramNode } from "@/types";

const EDGE_TRANSITION_EASING = "cubic-bezier(0.215, 0.61, 0.355, 1)";
const EDGE_TRANSITION = [
	`opacity 180ms ${EDGE_TRANSITION_EASING}`,
	`stroke-width 180ms ${EDGE_TRANSITION_EASING}`,
].join(", ");
const EMPTY_RELATION_COLUMNS = new Map<string, Set<string>>();

const getNodeIdFromEvent = (target: EventTarget | null) =>
	target instanceof HTMLElement
		? target.closest<HTMLElement>(".react-flow__node[data-id]")?.dataset.id ?? null
		: null;

const readEdgeStyleNumber = (
	value: number | string | undefined,
	fallback: number,
) => {
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

export function useRelationHighlighting(
	nodes: DiagramNode[],
	edges: DiagramEdge[],
) {
	const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
	const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
	const panModeEnabled = useDiagramUiStore((state) => state.panModeEnabled);
	const selectedTableIds = useDiagramUiStore((state) => state.selectedTableIds);
	const setFocusedTableIds = useDiagramUiStore((state) => state.setFocusedTableIds);
	const setSelectedTableIds = useDiagramUiStore((state) => state.setSelectedTableIds);

	const availableNodeIds = useMemo(
		() => new Set(nodes.map((node) => node.id)),
		[nodes],
	);
	const activeSelectedTableIds = useMemo(
		() => selectedTableIds.filter((id) => availableNodeIds.has(id)),
		[availableNodeIds, selectedTableIds],
	);

	const activeTableIds = useMemo(() => {
		const ids = new Set(
			panModeEnabled ? activeSelectedTableIds : [],
		);
		if (hoveredNodeId !== null && availableNodeIds.has(hoveredNodeId)) {
			ids.add(hoveredNodeId);
		}
		if (focusedNodeId !== null && availableNodeIds.has(focusedNodeId)) {
			ids.add(focusedNodeId);
		}
		return ids;
	}, [
		activeSelectedTableIds,
		availableNodeIds,
		focusedNodeId,
		hoveredNodeId,
		panModeEnabled,
	]);

	const activeRelationColumnsByTable = useMemo(() => {
		if (activeTableIds.size === 0) {
			return EMPTY_RELATION_COLUMNS;
		}

		const columnsByTable = new Map<string, Set<string>>();

		for (const edge of edges) {
			if (
				edge.data === undefined ||
				(!activeTableIds.has(edge.source) && !activeTableIds.has(edge.target))
			) {
				continue;
			}

			const sourceColumns = columnsByTable.get(edge.data.from.table) ?? new Set<string>();
			edge.data.from.columns.forEach((column) => sourceColumns.add(column));
			columnsByTable.set(edge.data.from.table, sourceColumns);

			const targetColumns = columnsByTable.get(edge.data.to.table) ?? new Set<string>();
			edge.data.to.columns.forEach((column) => targetColumns.add(column));
			columnsByTable.set(edge.data.to.table, targetColumns);
		}

		return columnsByTable;
	}, [activeTableIds, edges]);

	const displayNodes = useMemo(() => {
		if (activeRelationColumnsByTable.size === 0) {
			return nodes;
		}

		return nodes.map((node) => {
			const activeColumns = activeRelationColumnsByTable.get(node.id);
			if (!activeColumns || activeColumns.size === 0) {
				return node;
			}

			return {
				...node,
				data: {
					...node.data,
					activeRelationColumns: Array.from(activeColumns),
					isRelationContextActive: true,
				},
			} satisfies DiagramNode;
		});
	}, [activeRelationColumnsByTable, nodes]);

	const displayEdges = useMemo(() => {
		if (activeTableIds.size === 0) {
			return edges;
		}

		return edges.map((edge) => {
			if (edge.data === undefined) {
				return edge;
			}

			const isRelationSourceActive = activeTableIds.has(edge.source);
			const isRelationTargetActive = activeTableIds.has(edge.target);
			if (!isRelationSourceActive && !isRelationTargetActive) {
				return edge;
			}

			const baseStrokeWidth = readEdgeStyleNumber(edge.style?.strokeWidth, 1.4);
			const stroke = "var(--primary)";

			return {
				...edge,
				data: {
					...edge.data,
					isRelationActive: true,
					isRelationSourceActive,
					isRelationTargetActive,
				},
				style: {
					...edge.style,
					stroke,
					strokeWidth: baseStrokeWidth + 0.9,
					opacity: readEdgeStyleNumber(edge.style?.opacity, 1),
					transition: EDGE_TRANSITION,
				},
				markerEnd:
					edge.markerEnd && typeof edge.markerEnd === "object"
						? { ...edge.markerEnd, color: stroke }
						: edge.markerEnd,
			} satisfies DiagramEdge;
		});
	}, [activeTableIds, edges]);

	const onFocusCapture = useCallback((event: FocusEvent) => {
		const nodeId = getNodeIdFromEvent(event.target);
		if (nodeId !== null) {
			setFocusedNodeId((current) => (current === nodeId ? current : nodeId));
		}
	}, []);

	const onBlurCapture = useCallback((event: FocusEvent) => {
		const currentNodeId = getNodeIdFromEvent(event.target);
		if (currentNodeId === null) return;

		const nextFocusedNodeId = getNodeIdFromEvent(event.relatedTarget);
		setFocusedNodeId((current) =>
			current === nextFocusedNodeId ? current : nextFocusedNodeId,
		);
	}, []);

	const onNodeMouseEnter = useCallback((_: MouseEvent, node: DiagramNode) => {
		setHoveredNodeId((current) => (current === node.id ? current : node.id));
	}, []);

	const onNodeMouseLeave = useCallback((_: MouseEvent, node: DiagramNode) => {
		setHoveredNodeId((current) => (current === node.id ? null : current));
	}, []);

	const onSelectionChange = useCallback(
		({ nodes: selectedNodes }: { nodes: DiagramNode[] }) => {
			const nextIds = selectedNodes.map((node) => node.id).sort();
			setSelectedTableIds(nextIds);
			setFocusedTableIds(nextIds);
		},
		[setFocusedTableIds, setSelectedTableIds],
	);

	const handlers = useMemo(
		() => ({
			onFocusCapture,
			onBlurCapture,
			onNodeMouseEnter,
			onNodeMouseLeave,
			onSelectionChange,
		}),
		[
			onBlurCapture,
			onFocusCapture,
			onNodeMouseEnter,
			onNodeMouseLeave,
			onSelectionChange,
		],
	);

	return { displayNodes, displayEdges, handlers };
}
