import { describe, expect, it } from "vitest";

import {
	getSchemaParseCandidates,
	parseSchemaSource,
} from "../../src/parser-worker/schema-source-parser";

describe("schema-source-parser source ranges", () => {
	it("returns line/column/offset ranges for DBML tables keyed by table id", () => {
		const source = [
			"Table users {",
			"  id int [pk]",
			"}",
			"",
			"Table orders {",
			"  id int [pk]",
			"  user_id int",
			"}",
		].join("\n");

		const result = parseSchemaSource(source);

		expect(result.sourceRanges).not.toBeNull();
		expect(result.sourceRanges?.tablesById.users).toMatchObject({
			start: { line: 1, column: 1 },
		});
		expect(result.sourceRanges?.tablesById.orders).toMatchObject({
			start: { line: 5, column: 1 },
		});
	});

	it("returns ranges for DBML refs keyed by the same id used in ParsedSchema.refs", () => {
		const source = [
			"Table users {",
			"  id int [pk]",
			"}",
			"",
			"Table orders {",
			"  id int [pk]",
			"  user_id int",
			"}",
			"",
			"Ref: orders.user_id > users.id",
		].join("\n");

		const result = parseSchemaSource(source);

		expect(result.parsed.refs).toHaveLength(1);
		const refId = result.parsed.refs[0].id;
		expect(result.sourceRanges?.refsById[refId]).toMatchObject({
			start: { line: 10, column: 1 },
		});
	});

	it("returns null source ranges for SQL because tokens are unavailable", () => {
		const result = parseSchemaSource("CREATE TABLE users (id int primary key);");

		expect(result.sourceRanges).toBeNull();
	});
});

describe("schema-source-parser", () => {
	it("detects DBML first when the source uses DBML syntax", () => {
		expect(getSchemaParseCandidates("Table users {\n  id int [pk]\n}")[0]).toEqual({
			format: "dbml",
		});

		const result = parseSchemaSource("Table users {\n  id int [pk]\n}");

		expect(result.metadata).toEqual({
			format: "dbml",
		});
		expect(result.parsed.tables.map((table) => table.id)).toEqual(["users"]);
	});

	it("detects SQL first when the source uses SQL syntax", () => {
		expect(getSchemaParseCandidates("CREATE TABLE users (id int primary key);")[0]).toEqual({
			format: "sql",
			dialect: "postgres",
		});

		const result = parseSchemaSource("CREATE TABLE users (id int primary key);");

		expect(result.metadata).toEqual({
			format: "sql",
			dialect: "postgres",
		});
		expect(result.parsed.tables.map((table) => table.id)).toEqual(["users"]);
	});

	it("prioritizes MySQL when dialect-specific syntax is present", () => {
		const [firstCandidate] = getSchemaParseCandidates(
			"CREATE TABLE users (id int primary key) ENGINE=InnoDB;",
		);
		const result = parseSchemaSource(
			"CREATE TABLE users (id int primary key) ENGINE=InnoDB;",
		);

		expect(firstCandidate).toEqual({
			format: "sql",
			dialect: "mysql",
		});
		expect(result.metadata).toEqual({
			format: "sql",
			dialect: "mysql",
		});
	});
});
