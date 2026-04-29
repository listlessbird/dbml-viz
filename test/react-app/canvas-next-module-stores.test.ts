import { describe, expect, it } from "vitest";

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
		expect(firstStore.getState().flowInstance).toBeNull();
		expect(secondStore.getState().viewport).toEqual({ x: 0, y: 0, zoom: 1 });
	});

	it("builds Canvas Projection without depending on Viewport state", () => {
		const projectionRuntime: ProjectionRuntimeState = {
			focusTableIds: ["users"],
			activeRelationTableIds: [],
		};

		expect(buildCanvasProjection(emptyDiagram, projectionRuntime)).toEqual({
			nodes: [],
			edges: [],
			missingPositionIds: [],
		});
	});
});
