import type { ReactFlowInstance } from "@xyflow/react";

import {
	STICKY_NOTE_MIN_HEIGHT,
	STICKY_NOTE_MIN_WIDTH,
} from "@/canvas-next/sticky-note/measure";
import type { CanvasEdge, CanvasNode, SharedStickyNote } from "@/types";

const STICKY_NOTE_AUTHORING_ZOOM = 1.15;
const STICKY_NOTE_FOCUS_DURATION_MS = 260;

interface SpawnStickyNoteInput {
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
	void flowInstance.setCenter(
		flowPoint.x + STICKY_NOTE_MIN_WIDTH / 2,
		flowPoint.y + STICKY_NOTE_MIN_HEIGHT / 2,
		{
			duration: STICKY_NOTE_FOCUS_DURATION_MS,
			zoom: Math.max(flowInstance.getZoom(), STICKY_NOTE_AUTHORING_ZOOM),
		},
	);
	return id;
}
