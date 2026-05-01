import { describe, expect, it } from "vitest";

import { buildSchemaIndexes } from "@/schema-model/schema-indexes";
import { searchSchema } from "@/schema-model/schema-search";
import type { ParsedSchema, RefData, TableData } from "@/types";

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

const productsTable: TableData = {
	id: "products",
	name: "products",
	schema: "shop",
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
	],
	indexes: [],
};

const ordersToUsers: RefData = {
	id: "fk_orders_users:0",
	from: { table: "orders", columns: ["user_id"] },
	to: { table: "users", columns: ["id"] },
	type: "many_to_one",
};

const sampleSchema: ParsedSchema = {
	tables: [usersTable, ordersTable, productsTable],
	refs: [ordersToUsers],
	errors: [],
};

const indexes = buildSchemaIndexes(sampleSchema);

describe("searchSchema", () => {
	it("returns no matches for an empty query", () => {
		expect(searchSchema(indexes, "")).toEqual({
			matchedTableIds: [],
			relatedTableIds: [],
			highlightedEdgeIds: [],
		});
	});

	it("returns no matches for a whitespace-only query", () => {
		expect(searchSchema(indexes, "   ")).toEqual({
			matchedTableIds: [],
			relatedTableIds: [],
			highlightedEdgeIds: [],
		});
	});

	it("matches Tables by name case-insensitively", () => {
		const result = searchSchema(indexes, "USE");
		expect(result.matchedTableIds).toEqual(["users"]);
	});

	it("matches Tables by qualified schema-prefixed name", () => {
		const result = searchSchema(indexes, "shop.products");
		expect(result.matchedTableIds).toEqual(["products"]);
	});

	it("collects related Table ids from Schema Model Relationship lookups", () => {
		const result = searchSchema(indexes, "users");
		expect(result.matchedTableIds).toEqual(["users"]);
		expect(result.relatedTableIds).toEqual(["orders"]);
	});

	it("collects highlighted Relationship edge ids from matches", () => {
		const result = searchSchema(indexes, "users");
		expect(result.highlightedEdgeIds).toEqual(["fk_orders_users:0"]);
	});

	it("does not include matched Table ids in the related set", () => {
		const result = searchSchema(indexes, "rs");
		expect(result.matchedTableIds).toEqual(["orders", "users"]);
		expect(result.relatedTableIds).toEqual([]);
	});

	it("returns empty result when no Table matches", () => {
		expect(searchSchema(indexes, "nope")).toEqual({
			matchedTableIds: [],
			relatedTableIds: [],
			highlightedEdgeIds: [],
		});
	});
});
