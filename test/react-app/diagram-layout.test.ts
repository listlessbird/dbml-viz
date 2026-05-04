import { afterEach, describe, expect, it, vi } from "vitest";

import {
	detectOverlappingTablePositions,
	repairOverlappingTablePositions,
	runDiagramAutoLayout,
	updateTableOverlapForMovedTable,
} from "@/diagram-layout/diagram-layout";
import { placeMissingTablePositions } from "@/diagram-layout/fallback-placement";
import { createDiagramSessionStore } from "@/diagram-session/diagram-session-store";
import type { ParsedSchema } from "@/types";

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

const usersOrdersAndProducts: ParsedSchema = {
	tables: [table("users"), table("orders"), table("products")],
	refs: [
		{
			id: "users_orders",
			from: { table: "orders", columns: ["user_id"] },
			to: { table: "users", columns: ["id"] },
			type: "many_to_one",
		},
	],
	errors: [],
};

const makeChainSchema = (count: number): ParsedSchema => ({
	tables: Array.from({ length: count }, (_, index) => table(`table_${index}`)),
	refs: Array.from({ length: Math.max(0, count - 1) }, (_, index) => ({
		id: `ref_${index}`,
		from: { table: `table_${index + 1}`, columns: ["parent_id"] },
		to: { table: `table_${index}`, columns: ["id"] },
		type: "many_to_one",
	})),
	errors: [],
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("Diagram Layout fallback placement", () => {
	it("places connected Tables near each other and isolated Tables below them", () => {
		const result = placeMissingTablePositions(usersOrdersAndProducts, {});
		const users = result.tablePositions.users!;
		const orders = result.tablePositions.orders!;
		const products = result.tablePositions.products!;

		expect(users.x).not.toBe(orders.x);
		expect(Math.abs(users.y - orders.y)).toBeLessThan(260);
		expect(products.y).toBeGreaterThan(Math.max(users.y, orders.y));
	});

	it("returns deterministic Table Positions for newly added Tables", () => {
		const result = placeMissingTablePositions(threeTables, {
			users: { x: 100, y: 120 },
		});

		expect(result.missingTableIds).toEqual(["orders", "products"]);
		expect(result.missingTablePositions.orders?.y).toBeGreaterThan(120);
		expect(result.missingTablePositions.products?.x).toBeGreaterThan(
			result.missingTablePositions.orders?.x ?? 0,
		);
		expect(result.missingTablePositions.products?.y).toBe(
			result.missingTablePositions.orders?.y,
		);
		expect(result.tablePositions).toEqual({
			users: { x: 100, y: 120 },
			orders: result.missingTablePositions.orders,
			products: result.missingTablePositions.products,
		});
	});

	it("places a newly added connected Table near its positioned neighbour", () => {
		const result = placeMissingTablePositions(usersOrdersAndProducts, {
			users: { x: 500, y: 240 },
			products: { x: 100, y: 900 },
		});

		expect(result.missingTableIds).toEqual(["orders"]);
		expect(result.tablePositions.users).toEqual({ x: 500, y: 240 });
		expect(result.tablePositions.products).toEqual({ x: 100, y: 900 });
		expect(result.missingTablePositions.orders?.x).toBeGreaterThan(500);
		expect(Math.abs((result.missingTablePositions.orders?.y ?? 0) - 240)).toBeLessThan(
			260,
		);
	});

	it("places a large connected schema without overlapping Tables", () => {
		const largeSchema = makeChainSchema(100);
		const result = placeMissingTablePositions(largeSchema, {});

		expect(result.missingTableIds).toHaveLength(100);
		expect(
			detectOverlappingTablePositions(largeSchema, result.tablePositions)
				.hasOverlaps,
		).toBe(false);
	});
});

describe("Diagram Layout auto-layout", () => {
	it("returns Table Positions without allocating a layout Worker", async () => {
		vi.stubGlobal(
			"Worker",
			class {
				constructor() {
					throw new Error("Worker should not be allocated");
				}
			},
		);

		const result = await runDiagramAutoLayout(
			{
				parsedSchema: usersOrdersAndProducts,
				tablePositions: {},
				algorithm: "left-right",
			},
		);

		if (!result.ok) {
			throw new Error(result.diagnostic.message);
		}
		expect(result.tablePositions.users?.x).not.toBe(
			result.tablePositions.orders?.x,
		);
		expect(result.tablePositions.products?.y).toBeGreaterThan(
			Math.max(
				result.tablePositions.users?.y ?? 0,
				result.tablePositions.orders?.y ?? 0,
			),
		);
	});

	it("returns deterministic Table Positions from the Table Placer", async () => {
		const result = await runDiagramAutoLayout({
			parsedSchema: threeTables,
			tablePositions: {
				users: { x: 0, y: 0 },
			},
			algorithm: "left-right",
		});

		expect(result).toEqual({
			ok: true,
			tablePositions: {
				users: expect.any(Object),
				orders: expect.any(Object),
				products: expect.any(Object),
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
		);

		if (!result.ok) {
			throw new Error(result.diagnostic.message);
		}
		diagramStore.getState().commitTablePositions(result.tablePositions);

		expect(Object.keys(diagramStore.getState().diagram.tablePositions)).toEqual([
			"users",
			"orders",
			"products",
		]);
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
		const result = await repairOverlappingTablePositions({
			parsedSchema: threeTables,
			tablePositions: {
				users: { x: 0, y: 0 },
				orders: { x: 20, y: 20 },
				products: { x: 1000, y: 0 },
			},
			algorithm: "left-right",
		});

		if (!result.ok) {
			throw new Error(result.diagnostic.message);
		}
		expect(
			detectOverlappingTablePositions(threeTables, result.tablePositions)
				.hasOverlaps,
		).toBe(false);
	});
});

const canonicalizePair = (pair: {
	readonly firstTableId: string;
	readonly secondTableId: string;
}) => [pair.firstTableId, pair.secondTableId].sort().join("|");

const sameOverlapResult = (
	left: ReturnType<typeof detectOverlappingTablePositions>,
	right: ReturnType<typeof detectOverlappingTablePositions>,
) => {
	expect(left.hasOverlaps).toBe(right.hasOverlaps);
	expect([...left.overlappingTableIds].sort()).toEqual(
		[...right.overlappingTableIds].sort(),
	);
	expect(left.overlapPairs.map(canonicalizePair).sort()).toEqual(
		right.overlapPairs.map(canonicalizePair).sort(),
	);
};

describe("Diagram Layout incremental Overlap updates", () => {
	const emptyResult = {
		hasOverlaps: false as const,
		overlappingTableIds: [] as readonly string[],
		overlapPairs: [] as readonly {
			readonly firstTableId: string;
			readonly secondTableId: string;
		}[],
	};

	it("returns the same result as full recompute when nothing overlaps", () => {
		const positions = {
			users: { x: 0, y: 0 },
			orders: { x: 800, y: 0 },
			products: { x: 1600, y: 0 },
		};
		const incremental = updateTableOverlapForMovedTable({
			parsedSchema: threeTables,
			tablePositions: positions,
			movedTableId: "orders",
			previousResult: emptyResult,
		});
		sameOverlapResult(
			incremental,
			detectOverlappingTablePositions(threeTables, positions),
		);
		expect(incremental.hasOverlaps).toBe(false);
	});

	it("matches full recompute for a single overlapping pair after one move", () => {
		const positions = {
			users: { x: 0, y: 0 },
			orders: { x: 20, y: 20 },
			products: { x: 1600, y: 0 },
		};
		const incremental = updateTableOverlapForMovedTable({
			parsedSchema: threeTables,
			tablePositions: positions,
			movedTableId: "orders",
			previousResult: emptyResult,
		});
		sameOverlapResult(
			incremental,
			detectOverlappingTablePositions(threeTables, positions),
		);
	});

	it("matches full recompute for multi-pair overlaps under repeated incremental updates", () => {
		const positions = {
			users: { x: 0, y: 0 },
			orders: { x: 10, y: 10 },
			products: { x: 20, y: 20 },
		};
		let incremental: ReturnType<typeof detectOverlappingTablePositions> =
			emptyResult;
		for (const movedTableId of ["users", "orders", "products"]) {
			incremental = updateTableOverlapForMovedTable({
				parsedSchema: threeTables,
				tablePositions: positions,
				movedTableId,
				previousResult: incremental,
			});
		}
		sameOverlapResult(
			incremental,
			detectOverlappingTablePositions(threeTables, positions),
		);
		expect(incremental.hasOverlaps).toBe(true);
	});

	it("removes prior overlap pairs when a moved Table no longer overlaps neighbours", () => {
		const overlappingPositions = {
			users: { x: 0, y: 0 },
			orders: { x: 20, y: 20 },
			products: { x: 1600, y: 0 },
		};
		const overlapResult = detectOverlappingTablePositions(
			threeTables,
			overlappingPositions,
		);
		expect(overlapResult.hasOverlaps).toBe(true);

		const movedAwayPositions = {
			...overlappingPositions,
			orders: { x: 2000, y: 2000 },
		};
		const incremental = updateTableOverlapForMovedTable({
			parsedSchema: threeTables,
			tablePositions: movedAwayPositions,
			movedTableId: "orders",
			previousResult: overlapResult,
		});
		sameOverlapResult(
			incremental,
			detectOverlappingTablePositions(threeTables, movedAwayPositions),
		);
		expect(incremental.hasOverlaps).toBe(false);
	});
});
