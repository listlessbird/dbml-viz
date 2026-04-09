import { describe, expect, it } from "vitest";

import { estimateTableSize } from "@/lib/transform";
import type { TableData } from "@/types";

const buildTable = (type: string): TableData => ({
	id: "events",
	name: "webhook_events",
	columns: [
		{
			name: "id",
			type: "uuid",
			pk: true,
			notNull: true,
			unique: true,
			isForeignKey: false,
		},
		{
			name: "delivery_channel_configuration",
			type,
			pk: false,
			notNull: true,
			unique: false,
			isForeignKey: false,
		},
	],
});

describe("estimateTableSize", () => {
	it("widens long-type tables beyond the old fixed width", () => {
		const compact = estimateTableSize(buildTable("varchar"));
		const longType = estimateTableSize(buildTable("character_varying(255)"));

		expect(compact.width).toBeGreaterThanOrEqual(260);
		expect(longType.width).toBeGreaterThan(compact.width);
		expect(longType.width).toBeGreaterThan(260);
		expect(longType.width).toBeLessThanOrEqual(420);
	});
});
