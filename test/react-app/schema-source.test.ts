import { describe, expect, it } from "vitest";

import { SchemaParseError } from "@/lib/parser-shared";
import { parseSchemaSource } from "@/schema-source/parse-schema-source";
import type { ParsedSchema } from "@/types";

const parsedFixture: ParsedSchema = {
	tables: [
		{
			id: "users",
			name: "users",
			columns: [],
			indexes: [],
		},
	],
	refs: [],
	errors: [],
};

describe("Schema Source seam", () => {
	it("returns ok=true with Parsed Schema when the parser resolves", async () => {
		const result = await parseSchemaSource("Table users {}", {
			parser: async () => ({
				parsed: parsedFixture,
				metadata: { format: "dbml" },
			}),
		});

		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.parsedSchema).toEqual(parsedFixture);
			expect(result.metadata.format).toBe("dbml");
		}
	});

	it("returns ok=false with diagnostics when the parser throws SchemaParseError", async () => {
		const diagnostics = [
			{ message: "Unexpected token", location: { start: { line: 2, column: 5 } } },
		];

		const result = await parseSchemaSource("Table {", {
			parser: async () => {
				throw new SchemaParseError(diagnostics);
			},
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.diagnostics).toEqual(diagnostics);
		}
	});

	it("converts unexpected errors into a generic Parse Diagnostic", async () => {
		const result = await parseSchemaSource("Table users {}", {
			parser: async () => {
				throw new Error("network exploded");
			},
		});

		expect(result.ok).toBe(false);
		if (!result.ok) {
			expect(result.diagnostics).toHaveLength(1);
			expect(result.diagnostics[0]?.message).toBe("network exploded");
		}
	});
});
