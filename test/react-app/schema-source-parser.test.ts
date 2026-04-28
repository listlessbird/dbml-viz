import { describe, expect, it } from "vitest";

import {
	getSchemaParseCandidates,
	parseSchemaSource,
} from "../../src/parser-worker/schema-source-parser";

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
