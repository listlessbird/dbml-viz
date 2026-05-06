import { describe, expect, it } from "vitest";
import { Result } from "better-result";

import { createParserClient } from "../../src/worker/lib/parser-client";

const buildFetch = (respond: (request: Request) => Response | Promise<Response>) => ({
	fetch: async (input: RequestInfo, init?: RequestInit) => {
		const request = new Request(input as Request, init);
		return respond(request);
	},
});

const okSchema = {
	tables: [
		{
			id: "users",
			name: "users",
			columns: [
				{ name: "id", type: "int", pk: true, notNull: true, unique: true, isForeignKey: false, isIndexed: true },
				{ name: "email", type: "text", pk: false, notNull: true, unique: true, isForeignKey: false, isIndexed: false },
			],
			indexes: [],
		},
	],
	refs: [],
	errors: [],
};

describe("Parser Service Client", () => {
	it("returns source ranges from the parser when present in the 200 response", async () => {
		const sourceRanges = {
			tablesById: {
				users: {
					start: { line: 1, column: 1, offset: 0 },
					end: { line: 3, column: 1, offset: 30 },
				},
			},
			refsById: {},
		};
		const client = createParserClient({
			parserService: buildFetch(async () =>
				Response.json(
					{
						id: 1,
						ok: true,
						parsed: okSchema,
						metadata: { format: "dbml" },
						sourceRanges,
					},
					{ status: 200 },
				),
			),
		});

		const result = await client.parseSchemaSource("Table users { id int }");

		expect(Result.isOk(result)).toBe(true);
		if (Result.isOk(result)) {
			expect(result.value.sourceRanges).toEqual(sourceRanges);
		}
	});

	it("returns null source ranges when the parser does not include them", async () => {
		const client = createParserClient({
			parserService: buildFetch(async () =>
				Response.json(
					{ id: 1, ok: true, parsed: okSchema, metadata: { format: "sql", dialect: "postgres" } },
					{ status: 200 },
				),
			),
		});

		const result = await client.parseSchemaSource("CREATE TABLE users (id int);");

		expect(Result.isOk(result)).toBe(true);
		if (Result.isOk(result)) {
			expect(result.value.sourceRanges).toBeNull();
		}
	});

	it("returns parsed schema and metadata when the parser responds with 200", async () => {
		const captured: { body?: unknown; url?: string } = {};
		const client = createParserClient({
			parserService: buildFetch(async (request) => {
				captured.url = request.url;
				captured.body = await request.json();
				return Response.json(
					{ id: 1, ok: true, parsed: okSchema, metadata: { format: "dbml" } },
					{ status: 200 },
				);
			}),
		});

		const result = await client.parseSchemaSource("Table users { id int }");

		expect(Result.isOk(result)).toBe(true);
		if (Result.isOk(result)) {
			expect(result.value.parsed).toEqual(okSchema);
			expect(result.value.metadata).toEqual({ format: "dbml" });
		}
		expect(captured.url).toMatch(/\/api\/parse$/);
		expect(captured.body).toMatchObject({ source: "Table users { id int }" });
	});

	it("returns ParserSyntaxError carrying diagnostics when the parser responds with 400", async () => {
		const client = createParserClient({
			parserService: buildFetch(() =>
				Response.json(
					{
						id: 1,
						ok: false,
						diagnostics: [
							{ message: "Expected table body", location: { start: { line: 1, column: 5 } } },
						],
					},
					{ status: 400 },
				),
			),
		});

		const result = await client.parseSchemaSource("Table users {");

		expect(Result.isError(result)).toBe(true);
		if (Result.isError(result)) {
			expect(result.error._tag).toBe("ParserSyntaxError");
			expect(result.error.diagnostics).toEqual([
				{ message: "Expected table body", location: { start: { line: 1, column: 5 } } },
			]);
		}
	});

	it("returns ParserUnreachableError when the service binding fetch throws", async () => {
		const client = createParserClient({
			parserService: buildFetch(() => {
				throw new Error("upstream offline");
			}),
		});

		const result = await client.parseSchemaSource("Table users { id int }");

		expect(Result.isError(result)).toBe(true);
		if (Result.isError(result)) {
			expect(result.error._tag).toBe("ParserUnreachableError");
		}
	});

	it("returns ParserInvalidResponseError on unexpected status codes", async () => {
		const client = createParserClient({
			parserService: buildFetch(() => new Response("oops", { status: 500 })),
		});

		const result = await client.parseSchemaSource("Table users { id int }");

		expect(Result.isError(result)).toBe(true);
		if (Result.isError(result)) {
			expect(result.error._tag).toBe("ParserInvalidResponseError");
		}
	});
});
