import { describe, expect, it } from "vitest";

import { buildSampleStickyNotes, isSampleSchemaSource } from "@/lib/sample-dbml";

describe("sample-dbml presentation", () => {
	it("recognizes the bundled sample even with surrounding whitespace", async () => {
		const { SAMPLE_SCHEMA_SOURCE } = await import("@/lib/sample-dbml");

		expect(isSampleSchemaSource(`\n${SAMPLE_SCHEMA_SOURCE}\n`)).toBe(true);
		expect(isSampleSchemaSource("Table users {}")).toBe(false);
	});

	it("builds showcase notes as content-only note data", () => {
		const notes = buildSampleStickyNotes();

		expect(notes.map((note) => note.id)).toEqual([
			"sample-note-tenant-spine",
			"sample-note-inventory-path",
			"sample-note-fulfillment-loop",
		]);

		const [tenantNote, inventoryNote, fulfillmentNote] = notes;
		expect(tenantNote?.text).toContain("#memberships.invited_by_user_id");
		expect(inventoryNote?.text).toContain("#stock_lots.quantity_reserved");
		expect(fulfillmentNote?.text).toContain("#order_lines.allocated_qty");
	});
});
