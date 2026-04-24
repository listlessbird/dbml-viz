import { useCallback, useMemo, useState, useEffect } from "react";
import type { FocusEvent } from "react";

import { useDiagramUiStore } from "@/store/useDiagramUiStore";
import type { DiagramNode, DiagramEdge } from "@/types";
import { useRelationHighlightingStore } from "@/store/useRelationHighlightingStore";

const EMPTY_RELATION_COLUMNS = new Map<string, Set<string>>();

const getNodeIdFromEvent = (target: EventTarget | null) =>
	target instanceof HTMLElement
		? target.closest<HTMLElement>(".react-flow__node[data-id]")?.dataset.id ?? null
		: null;


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
			edge.data.from.columns.forEach((column: string) => sourceColumns.add(column));
			columnsByTable.set(edge.data.from.table, sourceColumns);

			const targetColumns = columnsByTable.get(edge.data.to.table) ?? new Set<string>();
			edge.data.to.columns.forEach((column: string) => targetColumns.add(column));
			columnsByTable.set(edge.data.to.table, targetColumns);
		}

		return columnsByTable;
	}, [activeTableIds, edges]);

	useEffect(() => {
		useRelationHighlightingStore.getState().setActiveElements(activeTableIds, activeRelationColumnsByTable);
	}, [activeTableIds, activeRelationColumnsByTable]);

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

	const onNodeMouseEnter = useCallback((_: React.MouseEvent, node: DiagramNode) => {
		setHoveredNodeId((current) => (current === node.id ? current : node.id));
	}, []);

	const onNodeMouseLeave = useCallback((_: React.MouseEvent, node: DiagramNode) => {
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

	return { handlers };
}
