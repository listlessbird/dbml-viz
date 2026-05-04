import { describe, expect, it, vi } from "vitest";

import { spawnStickyNote } from "@/canvas-next/sticky-note/spawn";
import type { SharedStickyNote } from "@/types";

interface FakeFlow {
	readonly screenToFlowPosition: (point: { x: number; y: number }) => {
		x: number;
		y: number;
	};
}

const makeFlow = (
	mapped: { x: number; y: number } = { x: 100, y: 200 },
): FakeFlow => ({
	screenToFlowPosition: vi.fn(() => mapped),
});

describe("spawnStickyNote", () => {
	it("returns null when no React Flow instance is attached", () => {
		const addStickyNote = vi.fn();
		const id = spawnStickyNote({
			flowInstance: null,
			addStickyNote,
			screenPoint: { x: 400, y: 300 },
		});
		expect(id).toBeNull();
		expect(addStickyNote).not.toHaveBeenCalled();
	});

	it("creates a sticky note at the screen-mapped flow position", () => {
		const flow = makeFlow({ x: 50, y: 80 });
		const addStickyNote = vi.fn<(note: SharedStickyNote) => void>();
		const id = spawnStickyNote({
			flowInstance: flow as unknown as Parameters<
				typeof spawnStickyNote
			>[0]["flowInstance"],
			addStickyNote,
			screenPoint: { x: 400, y: 300 },
		});
		expect(id).not.toBeNull();
		expect(addStickyNote).toHaveBeenCalledOnce();
		const note = addStickyNote.mock.calls[0]![0]!;
		expect(note.x).toBe(50);
		expect(note.y).toBe(80);
		expect(note.text).toBe("");
		expect(note.color).toBe("yellow");
		expect(note.width).toBeGreaterThan(0);
		expect(note.height).toBeGreaterThan(0);
		expect(note.id).toBe(id);
	});

	it("calls screenToFlowPosition with the provided screen point", () => {
		const screenToFlow = vi.fn(() => ({ x: 0, y: 0 }));
		const flow = { screenToFlowPosition: screenToFlow };
		spawnStickyNote({
			flowInstance: flow as unknown as Parameters<
				typeof spawnStickyNote
			>[0]["flowInstance"],
			addStickyNote: vi.fn(),
			screenPoint: { x: 123, y: 456 },
		});
		expect(screenToFlow).toHaveBeenCalledWith({ x: 123, y: 456 });
	});
});
