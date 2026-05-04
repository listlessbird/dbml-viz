import type { ReactFlowInstance } from "@xyflow/react";

import {
	STICKY_NOTE_MIN_HEIGHT,
	STICKY_NOTE_MIN_WIDTH,
} from "@/canvas-next/sticky-note/measure";
import type { CanvasEdge, CanvasNode, SharedStickyNote } from "@/types";

export interface SpawnStickyNoteInput {
	readonly flowInstance: ReactFlowInstance<CanvasNode, CanvasEdge> | null;
	readonly addStickyNote: (note: SharedStickyNote) => void;
	readonly screenPoint: { readonly x: number; readonly y: number };
}

export function spawnStickyNote({
	flowInstance,
	addStickyNote,
	screenPoint,
}: SpawnStickyNoteInput): string | null {
	if (!flowInstance) return null;
	const flowPoint = flowInstance.screenToFlowPosition({
		x: screenPoint.x,
		y: screenPoint.y,
	});
	const id = `sticky-${crypto.randomUUID()}`;
	const note: SharedStickyNote = {
		id,
		x: flowPoint.x,
		y: flowPoint.y,
		width: STICKY_NOTE_MIN_WIDTH,
		height: STICKY_NOTE_MIN_HEIGHT,
		color: "yellow",
		text: "",
		widthMode: "auto",
	};
	addStickyNote(note);
	return id;
}
