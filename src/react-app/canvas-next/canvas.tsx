import {
	Background,
	BackgroundVariant,
	Controls,
	MiniMap,
	ReactFlow,
	type OnNodesChange,
	type ReactFlowInstance,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo } from "react";

import { useCanvasRuntime } from "@/canvas-next/canvas-runtime-context";
import { buildCanvasProjection } from "@/canvas-next/canvas-projection";
import { collectTablePositionChanges } from "@/canvas-next/table-position-changes";
import { useSchemaParseFlow } from "@/canvas-next/use-schema-parse-flow";
import { useRelationHoverHandlers } from "@/canvas-next/use-relation-hover";
import { useDiagramSession } from "@/diagram-session/diagram-session-context";
import { placeMissingTablePositions } from "@/diagram-layout/fallback-placement";
import type { CanvasEdge, CanvasNode } from "@/types";

const proOptions = { hideAttribution: true } as const;

function SchemaParseFlowBridge() {
	useSchemaParseFlow();
	return null;
}

export function CanvasNextCanvas() {
	const parsedSchema = useDiagramSession((state) => state.diagram.parsedSchema);
	const tablePositions = useDiagramSession((state) => state.diagram.tablePositions);
	const stickyNotes = useDiagramSession((state) => state.diagram.stickyNotes);
	const activeRelationTableIds = useCanvasRuntime(
		(state) => state.activeRelationTableIds,
	);
	const temporaryRelationship = useCanvasRuntime(
		(state) => state.temporaryRelationship,
	);
	const searchHighlight = useCanvasRuntime((state) => state.searchHighlight);
	const relationHoverHandlers = useRelationHoverHandlers();
	const attachReactFlowInstance = useCanvasRuntime(
		(state) => state.attachReactFlowInstance,
	);
	const setViewport = useCanvasRuntime((state) => state.setViewport);
	const commitTablePositions = useDiagramSession(
		(state) => state.commitTablePositions,
	);
	const updateStickyNote = useDiagramSession((state) => state.updateStickyNote);
	const tablePlacement = useMemo(
		() => placeMissingTablePositions(parsedSchema, tablePositions),
		[parsedSchema, tablePositions],
	);
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
					tablePositions: tablePlacement.tablePositions,
					stickyNotes,
				},
				{
					activeRelationTableIds,
					temporaryRelationship,
					searchHighlight,
				},
			),
		[
			parsedSchema,
			tablePlacement.tablePositions,
			stickyNotes,
			activeRelationTableIds,
			temporaryRelationship,
			searchHighlight,
		],
	);
	useEffect(() => {
		if (tablePlacement.missingTableIds.length === 0) return;
		commitTablePositions(tablePlacement.missingTablePositions);
	}, [commitTablePositions, tablePlacement]);
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

	return (
		<div className="relative h-full min-h-0 overflow-hidden bg-background">
			<SchemaParseFlowBridge />
			<ReactFlow<CanvasNode, CanvasEdge>
				nodes={projection.nodes}
				edges={projection.edges}
				onNodesChange={handleNodesChange}
				onInit={(instance: ReactFlowInstance<CanvasNode, CanvasEdge>) =>
					attachReactFlowInstance(instance)
				}
				onViewportChange={setViewport}
				onNodeMouseEnter={relationHoverHandlers.onNodeMouseEnter}
				onNodeMouseLeave={relationHoverHandlers.onNodeMouseLeave}
				nodesConnectable={false}
				proOptions={proOptions}
			>
				<Background
					variant={BackgroundVariant.Dots}
					gap={20}
					size={1.4}
					color="color-mix(in oklab, var(--foreground) 10%, var(--background))"
				/>
				<MiniMap
					position="bottom-right"
					pannable={false}
					zoomable={false}
					className="border! border-border! bg-background!"
					maskColor="color-mix(in oklab, var(--muted) 84%, transparent)"
				/>
				<Controls position="bottom-left" showInteractive={false} />
			</ReactFlow>
		</div>
	);
}
