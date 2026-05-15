import { describe, expect, it } from "vitest";
import { Result } from "better-result";

import {
	extractLineRange,
	numberSourceLines,
	runSchemaSourceSliceTool,
	DEFAULT_SLICE_MAX_LINES,
} from "../../src/worker/workspace/mcp/tools/schema-source-slice";
import {
	createWorkspaceMcpContext,
	type CanvasPresence,
	type WorkspaceAgentApi,
} from "../../src/worker/workspace/mcp/context";
import {
	ParserSyntaxError,
	ParserUnreachableError,
	type ParserClient,
	type ParserParseOk,
} from "../../src/worker/lib/parser-client";
import type { WorkspaceMcpToolResult } from "../../src/worker/workspace/mcp/result";
import type { WorkspaceState } from "../../src/worker/workspace/workspace-types";

const dbmlSource = [
	"Table users {",
	"  id int [pk]",
	"  email text",
	"}",
	"",
	"Table orders {",
	"  id int [pk]",
	"  user_id int",
	"}",
	"",
	"Ref: orders.user_id > users.id",
].join("\n");

const baseWorkspace: WorkspaceState = {
	source: dbmlSource,
	positions: {},
	notes: [],
	baseline: null,
	updatedAt: 200,
};

const presence = (count: number): CanvasPresence => ({
	connected: count > 0,
	connectionCount: count,
});

const createAgentApi = (
	state: WorkspaceState | null,
	canvasConnections: number,
): WorkspaceAgentApi => ({
	get state() {
		return state;
	},
	get canvasPresence() {
		return presence(canvasConnections);
	},
	mutate() {},
	broadcast() {},
});

const buildParseOk = (overrides: Partial<ParserParseOk> = {}): ParserParseOk => ({
	parsed: {
		tables: [
			{
				id: "users",
				name: "users",
				columns: [
					{ name: "id", type: "int", pk: true, notNull: true, unique: true, isForeignKey: false, isIndexed: true },
					{ name: "email", type: "text", pk: false, notNull: false, unique: false, isForeignKey: false, isIndexed: false },
				],
				indexes: [],
			},
			{
				id: "orders",
				name: "orders",
				columns: [
					{ name: "id", type: "int", pk: true, notNull: true, unique: true, isForeignKey: false, isIndexed: true },
					{ name: "user_id", type: "int", pk: false, notNull: false, unique: false, isForeignKey: true, isIndexed: false },
				],
				indexes: [],
			},
		],
		refs: [
			{
				id: "orders:user_id->users:id:0",
				from: { table: "orders", columns: ["user_id"] },
				to: { table: "users", columns: ["id"] },
				type: "many_to_one",
			},
		],
		errors: [],
	},
	metadata: { format: "dbml" },
	sourceRanges: {
		tablesById: {
			users: {
				start: { line: 1, column: 1, offset: 0 },
				end: { line: 4, column: 2, offset: 44 },
			},
			orders: {
				start: { line: 6, column: 1, offset: 46 },
				end: { line: 9, column: 2, offset: 92 },
			},
		},
		refsById: {
			"orders:user_id->users:id:0": {
				start: { line: 11, column: 1, offset: 94 },
				end: { line: 11, column: 31, offset: 124 },
			},
		},
	},
	...overrides,
});

const stubClient = (
	respond: () => ReturnType<ParserClient["parseSchemaSource"]>,
): ParserClient => ({
	parseSchemaSource: respond,
});

const buildContext = (
	state: WorkspaceState | null,
	parserClient: ParserClient,
	canvasConnections = 0,
) =>
	createWorkspaceMcpContext({
		agent: createAgentApi(state, canvasConnections),
		parserClient,
	});

const readPayload = (result: WorkspaceMcpToolResult) => {
	const text = result.content[0]?.text;
	if (!text) throw new Error("Expected MCP text fallback content");
	return JSON.parse(text) as Record<string, unknown>;
};

describe("extractLineRange", () => {
	it("returns a single line with its offsets", () => {
		const source = "alpha\nbeta\ngamma\n";

		const result = extractLineRange(source, 2, 2);

		expect(result.text).toBe("beta");
		expect(result.startLine).toBe(2);
		expect(result.endLine).toBe(2);
		expect(result.startOffset).toBe(6);
		expect(result.endOffset).toBe(10);
	});

	it("returns multiple lines joined by newlines", () => {
		const source = "alpha\nbeta\ngamma\ndelta";

		const result = extractLineRange(source, 2, 3);

		expect(result.text).toBe("beta\ngamma");
		expect(result.startOffset).toBe(6);
		expect(result.endOffset).toBe(16);
	});

	it("clamps endLine beyond the last line", () => {
		const source = "alpha\nbeta";

		const result = extractLineRange(source, 1, 99);

		expect(result.endLine).toBe(2);
		expect(result.text).toBe("alpha\nbeta");
	});

	it("clamps startLine below 1", () => {
		const source = "alpha\nbeta";

		const result = extractLineRange(source, 0, 1);

		expect(result.startLine).toBe(1);
		expect(result.text).toBe("alpha");
	});
});

describe("numberSourceLines", () => {
	it("prefixes each line with a right-padded line number", () => {
		const numbered = numberSourceLines("alpha\nbeta", 9);

		expect(numbered).toBe(" 9: alpha\n10: beta");
	});
});

describe("runSchemaSourceSliceTool — table target", () => {
	it("returns the slice for a parsed Table with line numbers, exact text, and freshness", async () => {
		const context = buildContext(baseWorkspace, stubClient(async () => Result.ok(buildParseOk())));

		const result = await runSchemaSourceSliceTool(context, {
			target: { kind: "table", tableId: "users" },
		});

		expect(result.isError).toBeUndefined();
		const payload = readPayload(result);
		expect(payload).toMatchObject({
			ok: true,
			freshness: { updatedAt: 200 },
			truncated: false,
			target: { kind: "table", tableId: "users" },
			range: { startLine: 1, endLine: 4 },
			source: "Table users {\n  id int [pk]\n  email text\n}",
		});
		expect(payload.numberedSource).toContain("1: Table users {");
		expect(payload.numberedSource).toContain("4: }");
	});

	it("rejects an unknown table id with recovery guidance", async () => {
		const context = buildContext(baseWorkspace, stubClient(async () => Result.ok(buildParseOk())));

		const result = await runSchemaSourceSliceTool(context, {
			target: { kind: "table", tableId: "missing" },
		});

		expect(result.isError).toBe(true);
		expect(readPayload(result)).toMatchObject({
			ok: false,
			reason: "slice_target_not_found",
			recovery: expect.stringContaining("schema_overview"),
		});
	});
});

describe("runSchemaSourceSliceTool — relationship target", () => {
	it("returns the slice for a relationship by id", async () => {
		const context = buildContext(baseWorkspace, stubClient(async () => Result.ok(buildParseOk())));

		const result = await runSchemaSourceSliceTool(context, {
			target: { kind: "relationship", relationshipId: "orders:user_id->users:id:0" },
		});

		expect(result.isError).toBeUndefined();
		expect(readPayload(result)).toMatchObject({
			ok: true,
			range: { startLine: 11, endLine: 11 },
			source: "Ref: orders.user_id > users.id",
		});
	});
});

describe("runSchemaSourceSliceTool — diagnostic target", () => {
	it("centers the slice on the diagnostic line with default context lines", async () => {
		const diagnostics = [
			{ message: "Expected ','", location: { start: { line: 7, column: 3 } } },
		];
		const context = buildContext(
			baseWorkspace,
			stubClient(async () => Result.err(new ParserSyntaxError(diagnostics))),
		);

		const result = await runSchemaSourceSliceTool(context, {
			target: { kind: "diagnostic", index: 0 },
		});

		expect(result.isError).toBeUndefined();
		const payload = readPayload(result);
		expect(payload).toMatchObject({
			ok: true,
			range: { startLine: 4, endLine: 10 },
		});
	});

	it("rejects an out-of-range diagnostic index", async () => {
		const context = buildContext(
			baseWorkspace,
			stubClient(async () => Result.ok(buildParseOk())),
		);

		const result = await runSchemaSourceSliceTool(context, {
			target: { kind: "diagnostic", index: 5 },
		});

		expect(result.isError).toBe(true);
		expect(readPayload(result)).toMatchObject({
			ok: false,
			reason: "slice_target_not_found",
		});
	});
});

describe("runSchemaSourceSliceTool — line-range target", () => {
	it("returns slice for explicit line range even when ranges metadata is missing", async () => {
		const context = buildContext(
			baseWorkspace,
			stubClient(async () => Result.ok(buildParseOk({ sourceRanges: null }))),
		);

		const result = await runSchemaSourceSliceTool(context, {
			target: { kind: "lines", startLine: 6, endLine: 9 },
		});

		expect(result.isError).toBeUndefined();
		expect(readPayload(result)).toMatchObject({
			ok: true,
			range: { startLine: 6, endLine: 9 },
			source: "Table orders {\n  id int [pk]\n  user_id int\n}",
		});
	});

	it("rejects an inverted line range", async () => {
		const context = buildContext(
			baseWorkspace,
			stubClient(async () => Result.ok(buildParseOk())),
		);

		const result = await runSchemaSourceSliceTool(context, {
			target: { kind: "lines", startLine: 5, endLine: 2 },
		});

		expect(result.isError).toBe(true);
		expect(readPayload(result)).toMatchObject({
			ok: false,
			reason: "slice_line_range_invalid",
		});
	});
});

describe("runSchemaSourceSliceTool — truncation", () => {
	it("truncates oversized slices and returns guidance to narrow the request", async () => {
		const longSource = Array.from({ length: 500 }, (_, i) => `line${i + 1}`).join("\n");
		const context = buildContext(
			{ ...baseWorkspace, source: longSource },
			stubClient(async () => Result.ok(buildParseOk({ sourceRanges: null }))),
		);

		const result = await runSchemaSourceSliceTool(context, {
			target: { kind: "lines", startLine: 1, endLine: 500 },
		});

		expect(result.isError).toBeUndefined();
		const payload = readPayload(result);
		expect(payload).toMatchObject({
			ok: true,
			truncated: true,
			truncationGuidance: expect.stringContaining("narrower"),
			range: { startLine: 1, endLine: DEFAULT_SLICE_MAX_LINES },
		});
	});
});

describe("runSchemaSourceSliceTool — workspace gating", () => {
	it("rejects when no durable Workspace exists", async () => {
		const context = buildContext(null, stubClient(async () => Result.ok(buildParseOk())));

		const result = await runSchemaSourceSliceTool(context, {
			target: { kind: "table", tableId: "users" },
		});

		expect(result.isError).toBe(true);
		expect(readPayload(result)).toMatchObject({
			ok: false,
			reason: "workspace_not_active",
		});
	});

	it("works without Canvas Presence on a durable Workspace", async () => {
		const context = buildContext(
			baseWorkspace,
			stubClient(async () => Result.ok(buildParseOk())),
			0,
		);

		const result = await runSchemaSourceSliceTool(context, {
			target: { kind: "lines", startLine: 1, endLine: 1 },
		});

		expect(result.isError).toBeUndefined();
	});
});

describe("runSchemaSourceSliceTool — parser failures", () => {
	it("falls back to lines target when the parser cannot parse and target is lines", async () => {
		const context = buildContext(
			baseWorkspace,
			stubClient(async () =>
				Result.err(new ParserSyntaxError([{ message: "syntax" }])),
			),
		);

		const result = await runSchemaSourceSliceTool(context, {
			target: { kind: "lines", startLine: 1, endLine: 2 },
		});

		expect(result.isError).toBeUndefined();
		expect(readPayload(result)).toMatchObject({ ok: true });
	});

	it("returns parser_unavailable when the parser is unreachable", async () => {
		const context = buildContext(
			baseWorkspace,
			stubClient(async () => Result.err(new ParserUnreachableError())),
		);

		const result = await runSchemaSourceSliceTool(context, {
			target: { kind: "table", tableId: "users" },
		});

		expect(result.isError).toBe(true);
		expect(readPayload(result)).toMatchObject({
			ok: false,
			reason: "parser_unavailable",
		});
	});
});

describe("runSchemaSourceSliceTool — no full-source leakage", () => {
	it("does not include unrelated source when slicing a single table", async () => {
		const context = buildContext(
			baseWorkspace,
			stubClient(async () => Result.ok(buildParseOk())),
		);

		const result = await runSchemaSourceSliceTool(context, {
			target: { kind: "table", tableId: "users" },
		});

		const payload = readPayload(result);
		expect(payload.source).toBe("Table users {\n  id int [pk]\n  email text\n}");
		expect(JSON.stringify(payload)).not.toContain("Ref: orders.user_id");
		expect(JSON.stringify(payload)).not.toContain("Table orders");
	});
});
