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

		expect(compact.width).toBeGreaterThanOrEqual(300);
		expect(longType.width).toBeGreaterThan(compact.width);
		expect(longType.width).toBeGreaterThan(300);
		expect(longType.width).toBeLessThanOrEqual(480);
	});

	it("grows taller when a long column name has to wrap", () => {
		const compact = estimateTableSize(buildTable("varchar"));
		const wrapped = estimateTableSize({
			...buildTable("varchar"),
			columns: [
				buildTable("varchar").columns[0]!,
				{
					...buildTable("varchar").columns[1]!,
					name: "this_is_a_deliberately_extremely_long_column_name_that_should_wrap_inside_the_node_instead_of_being_truncated",
				},
			],
		});

		expect(wrapped.width).toBeLessThanOrEqual(480);
		expect(wrapped.height).toBeGreaterThan(compact.height);
	});

	it("widens before wrapping names when another row needs a wider type column", () => {
		const base = estimateTableSize({
			...buildTable("varchar"),
			columns: [
				buildTable("varchar").columns[0]!,
				{
					...buildTable("varchar").columns[1]!,
					name: "option_signature",
					type: "VARCHAR(191)",
				},
			],
		});
		const widenedTable = {
			...buildTable("varchar"),
			columns: [
				buildTable("varchar").columns[0]!,
				{
					...buildTable("varchar").columns[1]!,
					name: "option_signature",
					type: "VARCHAR(191)",
				},
				{
					name: "channel",
					type: "character_varying(255)",
					pk: false,
					notNull: true,
					unique: false,
					isForeignKey: false,
					isIndexed: false,
				},
			],
		};
		const widened = estimateTableSize(widenedTable);
		const reference = estimateTableSize({
			...widenedTable,
			columns: widenedTable.columns.map((column) =>
				column.name === "option_signature"
					? { ...column, name: "option_sig" }
					: column,
			),
		});

		expect(widened.width).toBeGreaterThan(base.width);
		expect(widened.width).toBe(359);
		expect(widened.width).toBeGreaterThan(reference.width);
		expect(widened.height).toBeLessThan(reference.height);
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
		expect(childNode?.data.layout.typeColumnWidth).toBeGreaterThan(0);
		expect(childNode?.height).toBe(childNode?.data.layout.height);
	});
});
