import { afterEach, describe, expect, it, vi } from "vitest";

import { createCanvasRuntimeStore } from "@/canvas-next/canvas-runtime-store";
import {
	createDiagramSessionStore,
	emptyDiagram,
} from "@/diagram-session/diagram-session-store";
import type { ParsedSchema } from "@/types";

afterEach(() => {
	vi.unstubAllGlobals();
});

const stubAnimationFrame = () => {
	let nextFrameId = 1;
	const callbacks = new Map<number, FrameRequestCallback>();
	vi.stubGlobal(
		"requestAnimationFrame",
		vi.fn((callback: FrameRequestCallback) => {
			const id = nextFrameId;
			nextFrameId += 1;
			callbacks.set(id, callback);
			return id;
		}),
	);
	vi.stubGlobal(
		"cancelAnimationFrame",
		vi.fn((id: number) => {
			callbacks.delete(id);
		}),
	);
	return {
		flush: () => {
			const pending = Array.from(callbacks.entries());
			callbacks.clear();
			for (const [id, callback] of pending) {
				callback(id);
			}
		},
	};
};

const usersAndOrders: ParsedSchema = {
	tables: [
		{ id: "users", name: "users", columns: [], indexes: [] },
		{ id: "orders", name: "orders", columns: [], indexes: [] },
	],
	refs: [],
	errors: [],
};

describe("Canvas Runtime Focus command", () => {
	it("changes the Viewport through fit-view without mutating Diagram state", () => {
		const raf = stubAnimationFrame();
		const sessionStore = createDiagramSessionStore();
		sessionStore.getState().replaceParsedSchema(usersAndOrders);
		sessionStore
			.getState()
			.commitTablePositions({ users: { x: 1, y: 2 }, orders: { x: 3, y: 4 } });
		const beforeDiagram = sessionStore.getState().diagram;

		const runtime = createCanvasRuntimeStore();
		const fitView = vi.fn();
		runtime.getState().attachReactFlowInstance({ fitView } as never);

		runtime.getState().requestFocus(["users"]);
		raf.flush();

		expect(fitView).toHaveBeenCalledWith({
			padding: 0.16,
			duration: 500,
			nodes: [{ id: "users" }],
		});
		expect(sessionStore.getState().diagram).toBe(beforeDiagram);
	});

	it("clears Focus through clearFocus without touching Diagram state", () => {
		const sessionStore = createDiagramSessionStore();
		sessionStore.getState().replaceParsedSchema(usersAndOrders);
		const beforeDiagram = sessionStore.getState().diagram;

		const runtime = createCanvasRuntimeStore();
		runtime.getState().requestFocus(["users", "orders"]);
		expect(runtime.getState().focusTableIds).toEqual(["users", "orders"]);

		runtime.getState().clearFocus();
		expect(runtime.getState().focusTableIds).toEqual([]);
		expect(sessionStore.getState().diagram).toBe(beforeDiagram);
	});

	it("exposes a requestFocus seam that any future caller (workspace, search) can reuse", () => {
		const runtime = createCanvasRuntimeStore();
		const fitView = vi.fn();
		const raf = stubAnimationFrame();
		runtime.getState().attachReactFlowInstance({ fitView } as never);

		const issueWorkspaceFocus = (state: ReturnType<typeof runtime.getState>) =>
			state.requestFocus(["orders"]);
		const issueSearchFocus = (state: ReturnType<typeof runtime.getState>) =>
			state.requestFocus(["users"]);

		issueWorkspaceFocus(runtime.getState());
		raf.flush();
		issueSearchFocus(runtime.getState());
		raf.flush();

		expect(fitView).toHaveBeenNthCalledWith(1, {
			padding: 0.16,
			duration: 500,
			nodes: [{ id: "orders" }],
		});
		expect(fitView).toHaveBeenNthCalledWith(2, {
			padding: 0.16,
			duration: 500,
			nodes: [{ id: "users" }],
		});
	});

	it("dispose leaves an empty Diagram untouched", () => {
		const sessionStore = createDiagramSessionStore();
		const runtime = createCanvasRuntimeStore();
		runtime.getState().requestFocus(["x"]);
		runtime.getState().dispose();
		expect(sessionStore.getState().diagram).toEqual(emptyDiagram);
	});
});
