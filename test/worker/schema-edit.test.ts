import { describe, expect, it } from "vitest";
import { Result } from "better-result";

import { createWorkspaceMcpServer } from "../../src/worker/workspace/mcp/server";
import {
	createWorkspaceMcpContext,
	type CanvasPresence,
} from "../../src/worker/workspace/mcp/context";
import {
	runSchemaEditTool,
	type SchemaEditInput,
} from "../../src/worker/workspace/mcp/tools/schema-edit";
import type {
	ParserClient,
	ParserParseOk,
} from "../../src/worker/lib/parser-client";
import { ParserSyntaxError } from "../../src/worker/lib/parser-client";
import type { WorkspaceStorage } from "../../src/worker/workspace/workspace-storage";
import type {
	ServerMessage,
	WorkspaceState,
} from "../../src/worker/workspace/workspace-types";
import { MAX_SCHEMA_SOURCE_LENGTH as maxSchemaSourceLength } from "../../src/worker/workspace/workspace-types";

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
	positions: { users: { x: 10, y: 20 } },
	notes: [
		{
			id: "sticky-1",
			x: 50,
			y: 60,
			width: 220,
			height: 180,
			color: "yellow",
			text: "#users owns login identity",
		},
	],
	diagnostics: [],
	parsedTableCount: 2,
	parsedRefCount: 1,
	baseline: null,
	createdAt: 100,
	updatedAt: 200,
	lastActivityAt: 200,
};

const presence = (count: number): CanvasPresence => ({
	connected: count > 0,
	connectionCount: count,
});

const parseOk = (): ParserParseOk => ({
	parsed: { tables: [], refs: [], errors: [] },
	metadata: { format: "dbml" },
	sourceRanges: null,
});

const stubParserClient = (
	respond: (source: string) => ReturnType<ParserClient["parseSchemaSource"]> = async () =>
		Result.ok(parseOk()),
): { client: ParserClient; calls: string[] } => {
	const calls: string[] = [];
	return {
		client: {
			parseSchemaSource: async (source) => {
				calls.push(source);
				return respond(source);
			},
		},
		calls,
	};
};

const createMutableStorage = (initial: WorkspaceState | null) => {
	let state = initial
		? { ...initial, positions: { ...initial.positions }, notes: [...initial.notes] }
		: null;
	const storage = {
		load: async () => state,
		touch: async () => {},
		saveAgentMutation: async (partial: Partial<WorkspaceState>) => {
			if (!state) return;
			state = {
				...state,
				...partial,
				updatedAt: 300,
				lastActivityAt: 300,
			};
		},
		get cached() {
			return state;
		},
	} as unknown as WorkspaceStorage;

	return {
		storage,
		get state() {
			return state;
		},
	};
};

const readPayload = (result: { content: readonly [{ readonly text: string }] }) =>
	JSON.parse(result.content[0].text) as Record<string, unknown>;

const runTool = async (
	workspace: WorkspaceState | null,
	input: SchemaEditInput,
	respond?: (source: string) => ReturnType<ParserClient["parseSchemaSource"]>,
	canvasConnections = 1,
) => {
	const mutable = createMutableStorage(workspace);
	const parser = stubParserClient(respond);
	const broadcasts: ServerMessage[] = [];
	const context = createWorkspaceMcpContext({
		storage: mutable.storage,
		getCanvasPresence: () => presence(canvasConnections),
		parserClient: parser.client,
	});

	const result = await runSchemaEditTool(
		{
			context,
			storage: mutable.storage,
			broadcast: (message) => broadcasts.push(message),
		},
		input,
	);

	return { result, payload: readPayload(result), mutable, broadcasts, parser };
};

describe("schema_edit", () => {
	it("requires an active durable Workspace", async () => {
		const { result, payload, broadcasts, parser } = await runTool(null, {
			knownSourceUpdatedAt: 200,
			oldString: "  email text",
			newString: "  email text\n  phone text",
		});

		expect(result.isError).toBe(true);
		expect(broadcasts).toEqual([]);
		expect(parser.calls).toEqual([]);
		expect(payload).toMatchObject({
			ok: false,
			reason: "workspace_not_active",
		});
	});

	it("requires Canvas Presence before applying an edit", async () => {
		const { result, payload, mutable, broadcasts, parser } = await runTool(
			baseWorkspace,
			{
				knownSourceUpdatedAt: 200,
				oldString: "  email text",
				newString: "  email text\n  phone text",
			},
			undefined,
			0,
		);

		expect(result.isError).toBe(true);
		expect(mutable.state?.source).toBe(baseWorkspace.source);
		expect(broadcasts).toEqual([]);
		expect(parser.calls).toEqual([]);
		expect(payload).toMatchObject({
			ok: false,
			reason: "canvas_not_connected",
		});
	});

	it("applies a single exact replacement and mutates only Schema Source", async () => {
		const { result, payload, mutable, broadcasts, parser } = await runTool(
			baseWorkspace,
			{
				knownSourceUpdatedAt: 200,
				oldString: "  email text",
				newString: "  email text\n  phone text",
			},
		);

		expect(result.isError).toBeUndefined();
		expect(mutable.state?.source).toContain("  phone text");
		expect(mutable.state?.positions).toEqual(baseWorkspace.positions);
		expect(mutable.state?.notes).toEqual(baseWorkspace.notes);
		expect(broadcasts).toEqual([
			{
				type: "state-update",
				patch: {
					source: mutable.state?.source,
					updatedAt: 300,
				},
			},
		]);
		expect(parser.calls).toEqual([mutable.state?.source]);
		expect(payload).toMatchObject({
			ok: true,
			freshness: { updatedAt: 300 },
			change: {
				startLine: 3,
				endLine: 4,
				oldLength: "  email text".length,
				newLength: "  email text\n  phone text".length,
			},
			diagnostics: [],
		});
		expect(payload.change).not.toHaveProperty("replacedAll");
	});

	it("rejects stale Workspace freshness without changing Schema Source", async () => {
		const { result, payload, mutable, broadcasts, parser } = await runTool(
			baseWorkspace,
			{
				knownSourceUpdatedAt: 199,
				oldString: "  email text",
				newString: "  email text\n  phone text",
			},
		);

		expect(result.isError).toBe(true);
		expect(mutable.state?.source).toBe(baseWorkspace.source);
		expect(broadcasts).toEqual([]);
		expect(parser.calls).toEqual([]);
		expect(payload).toMatchObject({
			ok: false,
			reason: "stale_workspace_freshness",
			currentUpdatedAt: 200,
			knownSourceUpdatedAt: 199,
			recovery: expect.stringContaining("schema_source_slice"),
		});
	});

	it("rejects a missing oldString with guidance to call schema_source_slice", async () => {
		const { result, payload, mutable, broadcasts, parser } = await runTool(
			baseWorkspace,
			{
				knownSourceUpdatedAt: 200,
				oldString: "  missing_column text",
				newString: "  missing_column text\n  phone text",
			},
		);

		expect(result.isError).toBe(true);
		expect(mutable.state?.source).toBe(baseWorkspace.source);
		expect(broadcasts).toEqual([]);
		expect(parser.calls).toEqual([]);
		expect(payload).toMatchObject({
			ok: false,
			reason: "old_string_not_found",
			recovery: expect.stringContaining("schema_source_slice"),
		});
	});

	it("rejects an ambiguous oldString without replaceAll", async () => {
		const { result, payload, mutable, broadcasts, parser } = await runTool(
			baseWorkspace,
			{
				knownSourceUpdatedAt: 200,
				oldString: "  id int [pk]",
				newString: "  id int [pk]\n  created_at timestamp",
			},
		);

		expect(result.isError).toBe(true);
		expect(mutable.state?.source).toBe(baseWorkspace.source);
		expect(broadcasts).toEqual([]);
		expect(parser.calls).toEqual([]);
		expect(payload).toMatchObject({
			ok: false,
			reason: "old_string_ambiguous",
			occurrenceCount: 2,
			recovery: expect.stringMatching(/replaceAll|surrounding context/i),
		});
	});

	it("applies every occurrence when replaceAll is true", async () => {
		const { result, payload, mutable, broadcasts, parser } = await runTool(
			baseWorkspace,
			{
				knownSourceUpdatedAt: 200,
				oldString: "  id int [pk]",
				newString: "  id bigint [pk]",
				replaceAll: true,
			},
		);

		expect(result.isError).toBeUndefined();
		const replacedSource = baseWorkspace.source.replaceAll(
			"  id int [pk]",
			"  id bigint [pk]",
		);
		expect(mutable.state?.source).toBe(replacedSource);
		expect(broadcasts).toEqual([
			{
				type: "state-update",
				patch: { source: replacedSource, updatedAt: 300 },
			},
		]);
		expect(parser.calls).toEqual([replacedSource]);
		expect(payload).toMatchObject({
			ok: true,
			freshness: { updatedAt: 300 },
			change: {
				oldLength: "  id int [pk]".length,
				newLength: "  id bigint [pk]".length,
				replacedAll: true,
				occurrenceCount: 2,
			},
			diagnostics: [],
		});
	});

	it("rejects a no-op edit when newString equals oldString", async () => {
		const { result, payload, mutable, broadcasts, parser } = await runTool(
			baseWorkspace,
			{
				knownSourceUpdatedAt: 200,
				oldString: "  email text",
				newString: "  email text",
			},
		);

		expect(result.isError).toBe(true);
		expect(mutable.state?.source).toBe(baseWorkspace.source);
		expect(broadcasts).toEqual([]);
		expect(parser.calls).toEqual([]);
		expect(payload).toMatchObject({
			ok: false,
			reason: "no_op_edit",
		});
	});

	it("rejects a parser-invalid edit without changing Schema Source or broadcasting", async () => {
		const diagnostics = [
			{ message: "Expected '}'", location: { start: { line: 4, column: 1 } } },
		];
		const { result, payload, mutable, broadcasts, parser } = await runTool(
			baseWorkspace,
			{
				knownSourceUpdatedAt: 200,
				oldString: "Table users {\n  id int [pk]\n  email text\n}",
				newString: "Table users {\n  id int [pk]\n  email text",
			},
			async () => Result.err(new ParserSyntaxError(diagnostics)),
		);

		expect(result.isError).toBe(true);
		expect(mutable.state?.source).toBe(baseWorkspace.source);
		expect(broadcasts).toEqual([]);
		expect(parser.calls).toEqual([
			baseWorkspace.source.replace(
				"Table users {\n  id int [pk]\n  email text\n}",
				"Table users {\n  id int [pk]\n  email text",
			),
		]);
		expect(payload).toMatchObject({
			ok: false,
			reason: "schema_parse_failed",
			message: expect.stringContaining("syntax or validation errors"),
			diagnostics,
			recovery: expect.stringContaining("schema_edit"),
		});
	});

	it("rejects an oversize edited Schema Source", async () => {
		const replacement = "x".repeat(maxSchemaSourceLength + 1);
		const { result, payload, mutable, broadcasts, parser } = await runTool(
			baseWorkspace,
			{
				knownSourceUpdatedAt: 200,
				oldString: "  email text",
				newString: replacement,
			},
		);

		expect(result.isError).toBe(true);
		expect(mutable.state?.source).toBe(baseWorkspace.source);
		expect(broadcasts).toEqual([]);
		expect(parser.calls).toEqual([]);
		expect(payload).toMatchObject({
			ok: false,
			reason: "schema_source_too_large",
			maxLength: maxSchemaSourceLength,
		});
	});

	describe("empty oldString (full-source replacement)", () => {
		const replacementSource = [
			"Table accounts {",
			"  id int [pk]",
			"  email text",
			"  status text",
			"}",
		].join("\n");

		it("replaces the entire Schema Source and mutates only Schema Source", async () => {
			const { result, payload, mutable, broadcasts, parser } = await runTool(
				baseWorkspace,
				{
					knownSourceUpdatedAt: 200,
					oldString: "",
					newString: replacementSource,
				},
			);

			expect(result.isError).toBeUndefined();
			expect(mutable.state?.source).toBe(replacementSource);
			expect(mutable.state?.positions).toEqual(baseWorkspace.positions);
			expect(mutable.state?.notes).toEqual(baseWorkspace.notes);
			expect(broadcasts).toEqual([
				{
					type: "state-update",
					patch: { source: replacementSource, updatedAt: 300 },
				},
			]);
			expect(parser.calls).toEqual([replacementSource]);
			expect(payload).toMatchObject({
				ok: true,
				freshness: { updatedAt: 300 },
				sourceSize: {
					oldLength: baseWorkspace.source.length,
					newLength: replacementSource.length,
				},
				diagnostics: [],
			});
			expect(payload.sourceSize).toMatchObject({
				oldLineCount: baseWorkspace.source.split("\n").length,
				newLineCount: replacementSource.split("\n").length,
			});
		});

		it("rejects an oversize full replacement", async () => {
			const oversized = "x".repeat(maxSchemaSourceLength + 1);
			const { result, payload, mutable, broadcasts, parser } = await runTool(
				baseWorkspace,
				{
					knownSourceUpdatedAt: 200,
					oldString: "",
					newString: oversized,
				},
			);

			expect(result.isError).toBe(true);
			expect(mutable.state?.source).toBe(baseWorkspace.source);
			expect(broadcasts).toEqual([]);
			expect(parser.calls).toEqual([]);
			expect(payload).toMatchObject({
				ok: false,
				reason: "schema_source_too_large",
				maxLength: maxSchemaSourceLength,
				sourceLength: maxSchemaSourceLength + 1,
			});
		});

		it("rejects a parser-invalid full replacement", async () => {
			const diagnostics = [
				{ message: "Expected '}'", location: { start: { line: 5, column: 1 } } },
			];
			const { result, payload, mutable, broadcasts, parser } = await runTool(
				baseWorkspace,
				{
					knownSourceUpdatedAt: 200,
					oldString: "",
					newString: replacementSource,
				},
				async () => Result.err(new ParserSyntaxError(diagnostics)),
			);

			expect(result.isError).toBe(true);
			expect(mutable.state?.source).toBe(baseWorkspace.source);
			expect(broadcasts).toEqual([]);
			expect(parser.calls).toEqual([replacementSource]);
			expect(payload).toMatchObject({
				ok: false,
				reason: "schema_parse_failed",
				diagnostics,
				recovery: expect.stringContaining("schema_edit"),
			});
		});

		it("rejects stale Workspace freshness on a full replacement", async () => {
			const { result, payload, mutable, broadcasts, parser } = await runTool(
				baseWorkspace,
				{
					knownSourceUpdatedAt: 199,
					oldString: "",
					newString: replacementSource,
				},
			);

			expect(result.isError).toBe(true);
			expect(mutable.state?.source).toBe(baseWorkspace.source);
			expect(broadcasts).toEqual([]);
			expect(parser.calls).toEqual([]);
			expect(payload).toMatchObject({
				ok: false,
				reason: "stale_workspace_freshness",
			});
		});
	});

	it("registers description guidance steering agents to schema_edit by default", () => {
		const mutable = createMutableStorage(baseWorkspace);
		const server = createWorkspaceMcpServer({
			storage: mutable.storage,
			getCanvasPresence: () => presence(1),
			parserClient: stubParserClient().client,
			broadcast: () => {},
		});
		const tools = (
			server as unknown as {
				_registeredTools: Record<string, { description?: string }>;
			}
		)._registeredTools;

		const editDescription = tools.schema_edit?.description ?? "";
		expect(editDescription).toContain("schema_source_slice");
		expect(editDescription).toContain("replaceAll");
		expect(editDescription).toMatch(/import|reset|broad redesign/i);
		expect(editDescription).toContain("schema_apply_patch");

		const applyPatchDescription = tools.schema_apply_patch?.description ?? "";
		expect(applyPatchDescription).toMatch(/atomic/i);
		expect(applyPatchDescription).toContain("schema_edit");

		const sliceDescription = tools.schema_source_slice?.description ?? "";
		expect(sliceDescription).toMatch(/paginat|advance|repeat/i);
		expect(sliceDescription).toContain("startLine");

		expect(tools.schema_replace_source).toBeUndefined();
	});

	it("integrates with a co-edit flow end to end", async () => {
		const { result, payload, mutable, broadcasts } = await runTool(
			baseWorkspace,
			{
				knownSourceUpdatedAt: 200,
				oldString: "  user_id int",
				newString: "  user_id int\n  status text",
			},
		);

		expect(result.isError).toBeUndefined();
		expect(payload).toMatchObject({
			ok: true,
			freshness: { updatedAt: 300 },
			change: {
				oldLength: "  user_id int".length,
				newLength: "  user_id int\n  status text".length,
			},
		});
		expect(mutable.state?.source).toContain("  status text");
		expect(broadcasts).toHaveLength(1);
	});
});
