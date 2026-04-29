import { afterEach, describe, expect, it, vi } from "vitest";

import {
	detectOverlappingTablePositions,
	repairOverlappingTablePositions,
	runDiagramAutoLayout,
} from "@/diagram-layout/diagram-layout";
import { placeMissingTablePositions } from "@/diagram-layout/fallback-placement";
import { buildCanvasProjection } from "@/canvas-next/canvas-projection";
import { createDiagramSessionStore } from "@/diagram-session/diagram-session-store";
import { autoLayoutDiagram } from "@/lib/layout";
import type { DiagramNode, ParsedSchema } from "@/types";

const table = (id: string) => ({
	id,
	name: id,
	columns: [],
	indexes: [],
});

const threeTables: ParsedSchema = {
	tables: [table("users"), table("orders"), table("products")],
	refs: [],
	errors: [],
};

afterEach(() => {
	vi.unstubAllGlobals();
	FakeWorker.instances = [];
});

class FakeWorker {
	static instances: FakeWorker[] = [];

	readonly listeners = new Map<string, Set<EventListener>>();
	readonly addEventListener = vi.fn((type: string, listener: EventListener) => {
		const listeners = this.listeners.get(type) ?? new Set<EventListener>();
		listeners.add(listener);
		this.listeners.set(type, listeners);
	});
	readonly removeEventListener = vi.fn(
		(type: string, listener: EventListener) => {
			this.listeners.get(type)?.delete(listener);
		},
	);
	readonly terminate = vi.fn();
	readonly postMessage = vi.fn();

	constructor() {
		FakeWorker.instances.push(this);
	}

	dispatch(type: string, event: unknown) {
		for (const listener of this.listeners.get(type) ?? []) {
			listener(event as Event);
		}
	}
}

const usersNode = (): DiagramNode => {
	const projection = buildCanvasProjection(
		{
			parsedSchema: {
				tables: [table("users")],
				refs: [],
				errors: [],
			},
			tablePositions: { users: { x: 0, y: 0 } },
		},
		{
			activeRelationTableIds: [],
			temporaryRelationship: null,
		},
	);
	return projection.nodes[0] as DiagramNode;
};

describe("Diagram Layout fallback placement", () => {
	it("returns deterministic Table Positions for newly added Tables", () => {
		const result = placeMissingTablePositions(threeTables, {
			users: { x: 100, y: 120 },
		});

		expect(result.missingTableIds).toEqual(["orders", "products"]);
		expect(result.missingTablePositions.orders?.x).toBeGreaterThan(100);
		expect(result.missingTablePositions.products?.x).toBe(
			result.missingTablePositions.orders?.x,
		);
		expect(result.missingTablePositions.products?.y).toBeGreaterThan(
			result.missingTablePositions.orders?.y ?? 0,
		);
		expect(result.tablePositions).toEqual({
			users: { x: 100, y: 120 },
			orders: result.missingTablePositions.orders,
			products: result.missingTablePositions.products,
		});
	});
});

describe("Diagram Layout ELK worker lifecycle", () => {
	it("terminates the ELK worker after successful layout", async () => {
		vi.stubGlobal("Worker", FakeWorker);
		const promise = autoLayoutDiagram([usersNode()], [], "left-right");
		const worker = FakeWorker.instances[0]!;

		worker.dispatch("message", {
			data: {
				type: "success",
				result: { children: [{ id: "users", x: 20, y: 40 }] },
			},
		});

		await expect(promise).resolves.toMatchObject([
			{ id: "users", position: { x: 20, y: 40 } },
		]);
		expect(worker.removeEventListener).toHaveBeenCalledWith(
			"message",
			expect.any(Function),
		);
		expect(worker.removeEventListener).toHaveBeenCalledWith(
			"error",
			expect.any(Function),
		);
		expect(worker.removeEventListener).toHaveBeenCalledWith(
			"messageerror",
			expect.any(Function),
		);
		expect(worker.terminate).toHaveBeenCalledTimes(1);
	});

	it("terminates the ELK worker after failed layout", async () => {
		vi.stubGlobal("Worker", FakeWorker);
		const promise = autoLayoutDiagram([usersNode()], [], "left-right");
		const worker = FakeWorker.instances[0]!;

		worker.dispatch("error", { message: "worker failed" });

		await expect(promise).rejects.toThrow("worker failed");
		expect(worker.terminate).toHaveBeenCalledTimes(1);
	});
});

describe("Diagram Layout auto-layout", () => {
	it("returns Table Positions from an ELK layout adapter", async () => {
		const result = await runDiagramAutoLayout(
			{
				parsedSchema: threeTables,
				tablePositions: {
					users: { x: 0, y: 0 },
				},
				algorithm: "left-right",
			},
			{
				autoLayout: async (nodes) =>
					nodes.map((node, index) => ({
						...node,
						position: { x: index * 200, y: index * 80 },
					})),
			},
		);

		expect(result).toEqual({
			ok: true,
			tablePositions: {
				users: { x: 0, y: 0 },
				orders: { x: 200, y: 80 },
				products: { x: 400, y: 160 },
			},
		});
	});

	it("returns a recoverable diagnostic when ELK layout fails", async () => {
		const result = await runDiagramAutoLayout(
			{
				parsedSchema: threeTables,
				tablePositions: {},
				algorithm: "compact",
			},
			{
				autoLayout: async () => {
					throw new Error("ELK layout worker crashed.");
				},
			},
		);

		expect(result).toEqual({
			ok: false,
			diagnostic: {
				message: "ELK layout worker crashed.",
			},
		});
	});

	it("commits successful auto-layout Table Positions through Diagram Session", async () => {
		const diagramStore = createDiagramSessionStore({
			source: "",
			parsedSchema: threeTables,
			tablePositions: { users: { x: 0, y: 0 } },
			stickyNotes: [],
		});
		const result = await runDiagramAutoLayout(
			{
				parsedSchema: diagramStore.getState().diagram.parsedSchema,
				tablePositions: diagramStore.getState().diagram.tablePositions,
				algorithm: "left-right",
			},
			{
				autoLayout: async (nodes) =>
					nodes.map((node, index) => ({
						...node,
						position: { x: index * 240, y: 12 },
					})),
			},
		);

		if (!result.ok) {
			throw new Error(result.diagnostic.message);
		}
		diagramStore.getState().commitTablePositions(result.tablePositions);

		expect(diagramStore.getState().diagram.tablePositions).toEqual({
			users: { x: 0, y: 12 },
			orders: { x: 240, y: 12 },
			products: { x: 480, y: 12 },
		});
	});
});

describe("Diagram Layout overlap recovery", () => {
	it("detects overlapping saved Table Positions", () => {
		const result = detectOverlappingTablePositions(threeTables, {
			users: { x: 0, y: 0 },
			orders: { x: 20, y: 20 },
			products: { x: 1000, y: 0 },
		});

		expect(result.hasOverlaps).toBe(true);
		expect(result.overlappingTableIds).toEqual(["users", "orders"]);
		expect(result.overlapPairs).toEqual([
			{ firstTableId: "users", secondTableId: "orders" },
		]);
	});

	it("repairs overlapping Table Positions with an auto-layout result", async () => {
		const result = await repairOverlappingTablePositions(
			{
				parsedSchema: threeTables,
				tablePositions: {
					users: { x: 0, y: 0 },
					orders: { x: 20, y: 20 },
					products: { x: 1000, y: 0 },
				},
				algorithm: "left-right",
			},
			{
				autoLayout: async (nodes) =>
					nodes.map((node, index) => ({
						...node,
						position: { x: index * 360, y: 0 },
					})),
			},
		);

		expect(result).toEqual({
			ok: true,
			tablePositions: {
				users: { x: 0, y: 0 },
				orders: { x: 360, y: 0 },
				products: { x: 720, y: 0 },
			},
		});
	});
});
