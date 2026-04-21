import type { ReactFlowInstance } from "@xyflow/react";
import { useCallback, useRef, type MutableRefObject } from "react";

import { useStickyNotesStore } from "@/store/useStickyNotesStore";
import type { CanvasEdge, CanvasNode } from "@/types";

// Reveal zoom level when spawning. Don't zoom out if already closer.
const REVEAL_ZOOM = 1.1;
// Stale pointer timestamps fall back to the viewport centre. 3s lines up
// with "user was just looking here" without trapping forgotten pointers.
const POINTER_FRESHNESS_MS = 3000;

// Single mutable slot — no per-event allocation while tracking the
// pointer on the React Flow pane.
interface PointerSlot {
	valid: boolean;
	clientX: number;
	clientY: number;
	at: number;
}

export interface StickyNoteSpawner {
	readonly onPaneMouseMove: (event: { clientX: number; clientY: number }) => void;
	readonly onPaneMouseLeave: () => void;
	readonly spawn: () => void;
}

export function useStickyNoteSpawner(
	instanceRef: MutableRefObject<ReactFlowInstance<CanvasNode, CanvasEdge> | null>,
): StickyNoteSpawner {
	const pointerRef = useRef<PointerSlot>({
		valid: false,
		clientX: 0,
		clientY: 0,
		at: 0,
	});

	const onPaneMouseMove = useCallback(
		(event: { clientX: number; clientY: number }) => {
			const slot = pointerRef.current;
			slot.valid = true;
			slot.clientX = event.clientX;
			slot.clientY = event.clientY;
			slot.at = performance.now();
		},
		[],
	);

	const onPaneMouseLeave = useCallback(() => {
		pointerRef.current.valid = false;
	}, []);

	const spawn = useCallback(() => {
		const instance = instanceRef.current;
		if (!instance) return;

		const slot = pointerRef.current;
		const isFresh =
			slot.valid && performance.now() - slot.at <= POINTER_FRESHNESS_MS;
		const spawnPoint = isFresh
			? instance.screenToFlowPosition({ x: slot.clientX, y: slot.clientY })
			: instance.screenToFlowPosition({
				x: window.innerWidth / 2,
				y: window.innerHeight / 2,
			});

		useStickyNotesStore.getState().addNote(spawnPoint);

		const targetZoom = Math.max(instance.getZoom(), REVEAL_ZOOM);
		void instance.setCenter(spawnPoint.x, spawnPoint.y, {
			zoom: targetZoom,
			duration: 320,
		});
	}, [instanceRef]);

	return { onPaneMouseMove, onPaneMouseLeave, spawn };
}
