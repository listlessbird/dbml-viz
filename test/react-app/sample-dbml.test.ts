import { describe, expect, it } from "vitest";

import { buildSampleStickyNotes, isSampleSchemaSource } from "@/lib/sample-dbml";
import type { DiagramNode } from "@/types";

const createNode = (
	id: string,
	x: number,
	y: number,
	width = 320,
	height = 180,
) =>
	({
		id,
		type: "table",
		position: { x, y },
		width,
		height,
		data: {
			table: {
				id,
				name: id,
				columns: [],
				indexes: [],
			},
			layout: {
				width,
				height,
				typeColumnWidth: 120,
			},
			accent: "var(--chart-1)",
			connectedColumns: [],
			isSearchMatch: false,
			isSearchRelated: false,
			isSearchDimmed: false,
			relationAnchors: [],
			compositeHandleOffsets: {},
		},
	} satisfies DiagramNode);

describe("sample-dbml presentation", () => {
	it("recognizes the bundled sample even with surrounding whitespace", async () => {
		const { SAMPLE_SCHEMA_SOURCE } = await import("@/lib/sample-dbml");

		expect(isSampleSchemaSource(`\n${SAMPLE_SCHEMA_SOURCE}\n`)).toBe(true);
		expect(isSampleSchemaSource("Table users {}")).toBe(false);
	});

	it("positions showcase notes around the expected sample table clusters", () => {
		const notes = buildSampleStickyNotes([
			createNode("tenants", 80, 120),
			createNode("tenant_settings", 460, 120),
			createNode("memberships", 460, 360),
			createNode("users", 80, 360),
			createNode("products", 980, 120),
			createNode("product_variants", 1360, 120),
			createNode("stock_lots", 1360, 360),
			createNode("warehouses", 980, 360),
			createNode("orders", 980, 700),
			createNode("order_lines", 1360, 700),
			createNode("pick_tasks", 1740, 700),
			createNode("invoices", 1360, 940),
		]);

		expect(notes.map((note) => note.id)).toEqual([
			"sample-note-tenant-spine",
			"sample-note-inventory-path",
			"sample-note-fulfillment-loop",
		]);

		const [tenantNote, inventoryNote, fulfillmentNote] = notes;
		expect(tenantNote?.y).toBeLessThan(120);
		expect(tenantNote?.text).toContain("#memberships.invited_by_user_id");
		expect(inventoryNote?.x).toBeGreaterThan(1680);
		expect(inventoryNote?.text).toContain("#stock_lots.quantity_reserved");
		expect(fulfillmentNote?.y).toBeGreaterThan(1120);
		expect(fulfillmentNote?.text).toContain("#order_lines.allocated_qty");
	});

	it("skips notes when a showcase cluster is incomplete", () => {
		const notes = buildSampleStickyNotes([
			createNode("tenants", 80, 120),
			createNode("tenant_settings", 460, 120),
			createNode("memberships", 460, 360),
		]);

		expect(notes).toEqual([]);
	});
});
