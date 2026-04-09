import { describe, expect, it } from "vitest";

import { parseDbmlSource } from "@/lib/dbml-schema";
import {
	getRelationSourceHandleId,
	getRelationTargetHandleId,
} from "@/lib/relation-handles";
import { buildDiagram, estimateTableSize } from "@/lib/transform";
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
			isIndexed: true,
		},
		{
			name: "delivery_channel_configuration",
			type,
			pk: false,
			notNull: true,
			unique: false,
			isForeignKey: false,
			isIndexed: false,
		},
	],
	indexes: [],
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

	it("accounts for inline composite constraint badges", () => {
		const withCompositeUnique = estimateTableSize({
			...buildTable("varchar"),
			indexes: [
				{
					id: "events:index:delivery-channel",
					kind: "unique",
					columns: ["id", "delivery_channel_configuration"],
				},
			],
		});

		expect(withCompositeUnique.height).toBeGreaterThan(
			estimateTableSize(buildTable("varchar")).height,
		);
	});
});

describe("buildDiagram", () => {
	it("uses composite relation anchors for multi-column foreign keys", () => {
		const parsed = parseDbmlSource(`
			Table parent {
			  tenant_id int [not null]
			  id int [not null]

			  indexes {
			    (tenant_id, id) [pk]
			  }
			}

			Table child {
			  tenant_id int [not null]
			  parent_id int [not null]
			}

			Ref fk_child_parent: child.(tenant_id, parent_id) > parent.(tenant_id, id)
		`);
		const [ref] = parsed.refs;
		const diagram = buildDiagram(parsed);
		const childNode = diagram.nodes.find((node) => node.id === "child");
		const parentNode = diagram.nodes.find((node) => node.id === "parent");
		const [edge] = diagram.edges;

		expect(ref).toBeDefined();
		expect(edge?.sourceHandle).toBe(getRelationSourceHandleId(ref.id));
		expect(edge?.targetHandle).toBe(getRelationTargetHandleId(ref.id));
		expect(childNode?.data.connectedColumns).toEqual(["tenant_id", "parent_id"]);
		expect(parentNode?.data.connectedColumns).toEqual(["tenant_id", "id"]);
		expect(childNode?.data.relationAnchors).toContainEqual({
			id: getRelationSourceHandleId(ref.id),
			columns: ["tenant_id", "parent_id"],
			side: "source",
		});
		expect(parentNode?.data.relationAnchors).toContainEqual({
			id: getRelationTargetHandleId(ref.id),
			columns: ["tenant_id", "id"],
			side: "target",
		});
	});
});
