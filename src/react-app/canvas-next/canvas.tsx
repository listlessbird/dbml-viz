import {
	Background,
	BackgroundVariant,
	Controls,
	MiniMap,
	ReactFlow,
	type EdgeTypes,
	type NodeTypes,
	type OnNodesChange,
	type ReactFlowInstance,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, type MouseEvent } from "react";

import { useCanvasRuntime } from "@/canvas-next/canvas-runtime-context";
import { buildCanvasProjection } from "@/canvas-next/canvas-projection";
import { collectTablePositionChanges } from "@/canvas-next/table-position-changes";
import { CanvasNextStickyNoteNode } from "@/canvas-next/sticky-note";
import { useParseDrivenFocus } from "@/canvas-next/use-parse-driven-focus";
import { useSchemaParseFlow } from "@/canvas-next/use-schema-parse-flow";
import { RelationshipEdge } from "@/components/RelationshipEdge";
import { StickyLinkEdge } from "@/components/StickyLinkEdge";
import { TableNode } from "@/components/TableNode";
import { useDiagramSession } from "@/diagram-session/diagram-session-context";
import type { CanvasEdge, CanvasNode } from "@/types";

const proOptions = { hideAttribution: true } as const;
const nodeTypes: NodeTypes = {
	table: TableNode,
	sticky: CanvasNextStickyNoteNode,
};
const edgeTypes: EdgeTypes = {
	relationship: RelationshipEdge,
	stickyLink: StickyLinkEdge,
};

function SchemaParseFlowBridge() {
	useSchemaParseFlow();
	return null;
}

function ParseDrivenFocusBridge() {
	useParseDrivenFocus();
	return null;
}

function ZoomLevelControl() {
	const zoom = useCanvasRuntime((state) => state.viewport.zoom);
	return (
		<div
			className="react-flow__controls-zoom-level"
			aria-label={`Zoom ${Math.round(zoom * 100)} percent`}
		>
			{Math.round(zoom * 100)}%
		</div>
	);
}

export function CanvasNextCanvas() {
	const parsedSchema = useDiagramSession((state) => state.diagram.parsedSchema);
	const tablePositions = useDiagramSession((state) => state.diagram.tablePositions);
	const stickyNotes = useDiagramSession((state) => state.diagram.stickyNotes);
	const selectedRelationshipId = useCanvasRuntime(
		(state) => state.selectedRelationshipId,
	);
	const temporaryRelationship = useCanvasRuntime(
		(state) => state.temporaryRelationship,
	);
	const searchHighlight = useCanvasRuntime((state) => state.searchHighlight);
	const selectRelationship = useCanvasRuntime((state) => state.selectRelationship);
	const clearRelationshipSelection = useCanvasRuntime(
		(state) => state.clearRelationshipSelection,
	);
	const attachReactFlowInstance = useCanvasRuntime(
		(state) => state.attachReactFlowInstance,
	);
	const setViewport = useCanvasRuntime((state) => state.setViewport);
	const commitTablePositions = useDiagramSession(
		(state) => state.commitTablePositions,
	);
	const updateStickyNote = useDiagramSession((state) => state.updateStickyNote);
	const tableCount = parsedSchema.tables.length;
	const minimapEnabled = tableCount <= 80;
	const onlyRenderVisibleElements = tableCount > 150;
	const tableIds = useMemo(
		() => new Set(parsedSchema.tables.map((table) => table.id)),
		[parsedSchema],
	);
	const stickyNoteIds = useMemo(
		() => new Set(stickyNotes.map((note) => note.id)),
		[stickyNotes],
	);
	const projection = useMemo(
		() =>
			buildCanvasProjection(
				{
					parsedSchema,
					tablePositions,
					stickyNotes,
				},
				{
					selectedRelationshipId,
					temporaryRelationship,
					searchHighlight,
				},
			),
		[
			parsedSchema,
			tablePositions,
			stickyNotes,
			selectedRelationshipId,
			temporaryRelationship,
			searchHighlight,
		],
	);
	const handleNodesChange = useCallback<OnNodesChange<CanvasNode>>(
		(changes) => {
			const positions = collectTablePositionChanges(changes, tableIds);
			if (Object.keys(positions).length > 0) {
				commitTablePositions(positions);
			}
			for (const change of changes) {
				if (
					change.type !== "position" ||
					change.position === undefined ||
					!stickyNoteIds.has(change.id)
				) {
					continue;
				}
				updateStickyNote(change.id, {
					x: change.position.x,
					y: change.position.y,
				});
			}
		},
		[commitTablePositions, stickyNoteIds, tableIds, updateStickyNote],
	);
	const handleEdgeClick = useCallback(
		(_: MouseEvent, edge: CanvasEdge) => {
			if (edge.type !== "relationship") return;
			selectRelationship(edge.id);
		},
		[selectRelationship],
	);
	const handlePaneClick = useCallback(() => {
		clearRelationshipSelection();
	}, [clearRelationshipSelection]);

	useEffect(() => {
		if (selectedRelationshipId === null) return;
		if (parsedSchema.refs.some((ref) => ref.id === selectedRelationshipId)) return;
		clearRelationshipSelection();
	}, [clearRelationshipSelection, parsedSchema.refs, selectedRelationshipId]);

	return (
		<div className="relative h-full min-h-0 overflow-hidden bg-background">
			<SchemaParseFlowBridge />
			<ParseDrivenFocusBridge />
			<ReactFlow<CanvasNode, CanvasEdge>
				nodes={projection.nodes}
				edges={projection.edges}
				onNodesChange={handleNodesChange}
				onEdgeClick={handleEdgeClick}
				onPaneClick={handlePaneClick}
				onInit={(instance: ReactFlowInstance<CanvasNode, CanvasEdge>) =>
					attachReactFlowInstance(instance)
				}
				onViewportChange={setViewport}
				nodeTypes={nodeTypes}
				edgeTypes={edgeTypes}
				nodesConnectable={false}
				onlyRenderVisibleElements={onlyRenderVisibleElements}
				proOptions={proOptions}
			>
				<Background
					variant={BackgroundVariant.Dots}
					gap={20}
					size={1.4}
					color="color-mix(in oklab, var(--foreground) 10%, var(--background))"
				/>
				{minimapEnabled ? (
					<MiniMap
						position="bottom-right"
						pannable={false}
						zoomable={false}
						className="border! border-border! bg-background!"
						maskColor="color-mix(in oklab, var(--muted) 84%, transparent)"
					/>
				) : null}
				<Controls position="bottom-left" showInteractive={false}>
					<ZoomLevelControl />
				</Controls>
			</ReactFlow>
		</div>
	);
}
