import type { ReactFlowInstance } from "@xyflow/react";

import {
	STICKY_NOTE_MIN_HEIGHT,
	STICKY_NOTE_MIN_WIDTH,
} from "@/canvas-next/sticky-note/measure";
import { getTableNodeLayout } from "@/components/table-node/layout";
import type {
	CanvasEdge,
	CanvasNode,
	DiagramPositions,
	SharedStickyNote,
	TableData,
} from "@/types";

const NOTE_OFFSET_X = 40;

interface SpawnStickyNoteForTableInput {
	readonly flowInstance: ReactFlowInstance<CanvasNode, CanvasEdge> | null;
	readonly addStickyNote: (note: SharedStickyNote) => void;
	readonly table: TableData;
	readonly tablePositions: DiagramPositions;
}

export function spawnStickyNoteForTable({
	flowInstance,
	addStickyNote,
	table,
	tablePositions,
}: SpawnStickyNoteForTableInput): string | null {
	const id = `sticky-${crypto.randomUUID()}`;
	const tablePosition = tablePositions[table.id];
	const layout = getTableNodeLayout(table);

	let x: number;
	let y: number;
	if (tablePosition) {
		x = tablePosition.x + layout.width + NOTE_OFFSET_X;
		y = tablePosition.y;
	} else if (flowInstance) {
		const center = flowInstance.screenToFlowPosition({
			x: typeof window === "undefined" ? 0 : window.innerWidth / 2,
			y: typeof window === "undefined" ? 0 : window.innerHeight / 2,
		});
		x = center.x;
		y = center.y;
	} else {
		x = 0;
		y = 0;
	}

	const note: SharedStickyNote = {
		id,
		color: "yellow",
		text: `#${table.name}\n`,
		x,
		y,
	};
	addStickyNote(note);

	if (flowInstance) {
		void flowInstance.setCenter(
			x + STICKY_NOTE_MIN_WIDTH / 2,
			y + STICKY_NOTE_MIN_HEIGHT / 2,
			{ duration: 260, zoom: Math.max(flowInstance.getZoom(), 1.05) },
		);
	}

	return id;
}
