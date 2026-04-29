import { describe, expect, it } from "vitest";

import { buildSchemaIndexes } from "@/schema-model/schema-indexes";
import type { ParsedSchema, RefData, TableData } from "@/types";

const compositeRef: RefData = {
	id: "fk_child_parent:0",
	from: { table: "child", columns: ["tenant_id", "parent_id"] },
	to: { table: "parent", columns: ["tenant_id", "id"] },
	type: "many_to_one",
	name: "fk_child_parent",
};

const childTable: TableData = {
	id: "child",
	name: "child",
	columns: [
		{
			name: "tenant_id",
			type: "int",
			pk: false,
			notNull: true,
			unique: false,
			isForeignKey: true,
			isIndexed: false,
		},
		{
			name: "parent_id",
			type: "int",
			pk: false,
			notNull: true,
			unique: false,
			isForeignKey: true,
			isIndexed: false,
		},
	],
	indexes: [],
};

const parentTable: TableData = {
	id: "parent",
	name: "parent",
	columns: [
		{
			name: "tenant_id",
			type: "int",
			pk: false,
			notNull: true,
			unique: false,
			isForeignKey: false,
			isIndexed: false,
		},
		{
			name: "id",
			type: "int",
			pk: false,
			notNull: true,
			unique: false,
			isForeignKey: false,
			isIndexed: false,
		},
	],
	indexes: [],
};

const usersTable: TableData = {
	id: "users",
	name: "users",
	columns: [
		{
			name: "id",
			type: "int",
			pk: true,
			notNull: true,
			unique: false,
			isForeignKey: false,
			isIndexed: true,
		},
		{
			name: "email",
			type: "varchar(255)",
			pk: false,
			notNull: true,
			unique: true,
			isForeignKey: false,
			isIndexed: true,
		},
	],
	indexes: [],
};

const ordersTable: TableData = {
	id: "orders",
	name: "orders",
	columns: [
		{
			name: "id",
			type: "int",
			pk: true,
			notNull: true,
			unique: false,
			isForeignKey: false,
			isIndexed: true,
		},
		{
			name: "user_id",
			type: "int",
			pk: false,
			notNull: true,
			unique: false,
			isForeignKey: true,
			isIndexed: false,
		},
	],
	indexes: [],
};

const userOrdersRef: RefData = {
	id: "orders:user_id->users:id:0",
	from: { table: "orders", columns: ["user_id"] },
	to: { table: "users", columns: ["id"] },
	type: "many_to_one",
};

const buildParsedSchema = (
	tables: readonly TableData[],
	refs: readonly RefData[] = [],
): ParsedSchema => ({
	tables,
	refs,
	errors: [],
});

describe("Schema Model lookup maps", () => {
	it("indexes Tables by deterministic id", () => {
		const indexes = buildSchemaIndexes(buildParsedSchema([usersTable, ordersTable]));

		expect(indexes.tablesById.get("users")).toBe(usersTable);
		expect(indexes.tablesById.get("orders")).toBe(ordersTable);
		expect(indexes.tablesById.size).toBe(2);
	});

	it("groups Relationships by both endpoints' Table id", () => {
		const indexes = buildSchemaIndexes(
			buildParsedSchema([usersTable, ordersTable], [userOrdersRef]),
		);

		expect(indexes.refsByTableId.get("orders")).toEqual([userOrdersRef]);
		expect(indexes.refsByTableId.get("users")).toEqual([userOrdersRef]);
	});

	it("indexes Columns by composite (Table id, Column name) key", () => {
		const indexes = buildSchemaIndexes(buildParsedSchema([usersTable, ordersTable]));

		expect(indexes.columnsByTableAndName.get("users:id")?.name).toBe("id");
		expect(indexes.columnsByTableAndName.get("orders:user_id")?.isForeignKey).toBe(true);
		expect(indexes.columnsByTableAndName.get("orders:missing")).toBeUndefined();
	});

	it("collects foreign-key Columns per source Table for projection", () => {
		const indexes = buildSchemaIndexes(
			buildParsedSchema([usersTable, ordersTable], [userOrdersRef]),
		);

		expect(indexes.foreignKeyColumnsByTableId.get("orders")).toEqual(
			new Set(["user_id"]),
		);
		expect(indexes.foreignKeyColumnsByTableId.get("users")).toBeUndefined();
	});
});

describe("Schema Model Relation Anchors", () => {
	it("resolves single-column Relationship Endpoints to per-Column anchor ids", () => {
		const indexes = buildSchemaIndexes(
			buildParsedSchema([usersTable, ordersTable], [userOrdersRef]),
		);
		const [resolved] = indexes.relationships;

		expect(indexes.relationships).toHaveLength(1);
		expect(resolved?.ref).toBe(userOrdersRef);
		expect(resolved?.from).toEqual({
			id: "orders-user_id-source",
			tableId: "orders",
			columns: ["user_id"],
			side: "source",
		});
		expect(resolved?.to).toEqual({
			id: "users-id-target",
			tableId: "users",
			columns: ["id"],
			side: "target",
		});
	});

	it("resolves composite Relationship Endpoints to deterministic ref-scoped anchor ids", () => {
		const indexes = buildSchemaIndexes(
			buildParsedSchema([childTable, parentTable], [compositeRef]),
		);
		const [resolved] = indexes.relationships;

		expect(resolved?.from).toEqual({
			id: "fk_child_parent:0-source",
			tableId: "child",
			columns: ["tenant_id", "parent_id"],
			side: "source",
		});
		expect(resolved?.to).toEqual({
			id: "fk_child_parent:0-target",
			tableId: "parent",
			columns: ["tenant_id", "id"],
			side: "target",
		});
	});

	it("groups Relation Anchors by their Table id for projection lookups", () => {
		const indexes = buildSchemaIndexes(
			buildParsedSchema(
				[usersTable, ordersTable, childTable, parentTable],
				[userOrdersRef, compositeRef],
			),
		);

		expect(indexes.relationAnchorsByTableId.get("orders")).toEqual([
			{
				id: "orders-user_id-source",
				tableId: "orders",
				columns: ["user_id"],
				side: "source",
			},
		]);
		expect(indexes.relationAnchorsByTableId.get("users")).toEqual([
			{
				id: "users-id-target",
				tableId: "users",
				columns: ["id"],
				side: "target",
			},
		]);
		expect(indexes.relationAnchorsByTableId.get("child")).toEqual([
			{
				id: "fk_child_parent:0-source",
				tableId: "child",
				columns: ["tenant_id", "parent_id"],
				side: "source",
			},
		]);
		expect(indexes.relationAnchorsByTableId.get("parent")).toEqual([
			{
				id: "fk_child_parent:0-target",
				tableId: "parent",
				columns: ["tenant_id", "id"],
				side: "target",
			},
		]);
	});

	it("returns no Relation Anchors for Tables that are not endpoints", () => {
		const isolatedTable: TableData = {
			id: "loners",
			name: "loners",
			columns: [],
			indexes: [],
		};
		const indexes = buildSchemaIndexes(
			buildParsedSchema([usersTable, ordersTable, isolatedTable], [userOrdersRef]),
		);

		expect(indexes.relationAnchorsByTableId.get("loners")).toBeUndefined();
	});
});
