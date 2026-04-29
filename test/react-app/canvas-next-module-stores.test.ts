import { afterEach, describe, expect, it, vi } from "vitest";

import {
	createCanvasRuntimeStore,
	type ProjectionRuntimeState,
} from "@/canvas-next/canvas-runtime-store";
import { buildCanvasProjection } from "@/canvas-next/canvas-projection";
import {
	createDiagramSessionStore,
	emptyDiagram,
} from "@/diagram-session/diagram-session-store";
import type { ParsedSchema } from "@/types";

const usersOnly: ParsedSchema = {
	tables: [{ id: "users", name: "users", columns: [], indexes: [] }],
	refs: [],
	errors: [],
};

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
		callbacks,
		flush: () => {
			const pending = Array.from(callbacks.entries());
			callbacks.clear();
			for (const [id, callback] of pending) {
				callback(id);
			}
		},
	};
};

describe("canvas-next Module Stores", () => {
	it("creates scoped Diagram Session stores with command-based durable mutations", () => {
		const firstStore = createDiagramSessionStore();
		const secondStore = createDiagramSessionStore();

		firstStore.getState().setSchemaSource("Table users { id int [pk] }");
		firstStore.getState().replaceParsedSchema(usersOnly);
		firstStore.getState().commitTablePositions({ users: { x: 40, y: 80 } });

		expect(firstStore.getState().diagram.source).toBe(
			"Table users { id int [pk] }",
		);
		expect(firstStore.getState().toSchemaPayload().positions).toEqual({
			users: { x: 40, y: 80 },
		});
		expect(secondStore.getState().diagram).toEqual(emptyDiagram);
	});

	it("creates scoped Canvas Runtime stores and disposes ephemeral state", () => {
		const firstStore = createCanvasRuntimeStore();
		const secondStore = createCanvasRuntimeStore();

		firstStore.getState().setViewport({ x: 10, y: 20, zoom: 1.5 });
		firstStore.getState().requestFocus(["orders", "users", "orders"]);
		firstStore.getState().setActiveRelationTableIds(["orders", "orders"]);
		firstStore.getState().attachReactFlowInstance({} as never);

		expect(firstStore.getState().viewport).toEqual({ x: 10, y: 20, zoom: 1.5 });
		expect(firstStore.getState().focusTableIds).toEqual(["orders", "users"]);
		expect(firstStore.getState().activeRelationTableIds).toEqual(["orders"]);
		expect(firstStore.getState().flowInstance).toBeTruthy();

		firstStore.getState().dispose();

		expect(firstStore.getState().viewport).toEqual({ x: 0, y: 0, zoom: 1 });
		expect(firstStore.getState().focusTableIds).toEqual([]);
		expect(firstStore.getState().activeRelationTableIds).toEqual([]);
		expect(firstStore.getState().temporaryRelationship).toBeNull();
		expect(firstStore.getState().flowInstance).toBeNull();
		expect(secondStore.getState().viewport).toEqual({ x: 0, y: 0, zoom: 1 });
	});

	it("schedules Focus through one fit-view owner and cancels pending work on dispose", () => {
		const raf = stubAnimationFrame();
		const store = createCanvasRuntimeStore();
		const fitView = vi.fn();

		store.getState().attachReactFlowInstance({ fitView } as never);
		store.getState().requestFocus(["users", "users"]);

		expect(store.getState().focusTableIds).toEqual(["users"]);
		expect(fitView).not.toHaveBeenCalled();

		raf.flush();

		expect(fitView).toHaveBeenCalledWith({
			padding: 0.16,
			duration: 500,
			nodes: [{ id: "users" }],
		});

		store.getState().requestFitView(["users"]);
		store.getState().dispose();
		raf.flush();

		expect(fitView).toHaveBeenCalledTimes(1);
		expect(store.getState().flowInstance).toBeNull();
	});

	it("cleans up temporary relationship previews through Canvas Runtime commands", () => {
		const store = createCanvasRuntimeStore();

		store
			.getState()
			.startTemporaryRelationship({ sourceTableId: "orders" });
		store
			.getState()
			.updateTemporaryRelationshipCursor({ x: 12, y: 34 });
		store.getState().setTemporaryRelationshipTarget("users");

		expect(store.getState().temporaryRelationship).toEqual({
			kind: "relationship-preview",
			sourceTableId: "orders",
			targetTableId: "users",
			cursorPosition: { x: 12, y: 34 },
		});

		store.getState().cancelTemporaryRelationship();

		expect(store.getState().temporaryRelationship).toBeNull();
	});

	it("builds Canvas Projection without depending on Viewport state", () => {
		const projectionRuntime: ProjectionRuntimeState = {
			activeRelationTableIds: [],
			temporaryRelationship: null,
		};

		expect(buildCanvasProjection(emptyDiagram, projectionRuntime)).toEqual({
			nodes: [],
			edges: [],
			missingPositionIds: [],
		});
	});
});
