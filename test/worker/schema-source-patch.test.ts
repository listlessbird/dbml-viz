import { describe, expect, it } from "vitest";
import { Result } from "better-result";

import {
	createWorkspaceMcpContext,
	type CanvasPresence,
	type WorkspaceAgentApi,
} from "../../src/worker/workspace/mcp/context";
import {
	runSchemaApplyPatchTool,
	type SchemaApplyPatchInput,
} from "../../src/worker/workspace/mcp/tools/schema-apply-patch";
import type {
	ParserClient,
	ParserParseOk,
} from "../../src/worker/lib/parser-client";
import { ParserSyntaxError } from "../../src/worker/lib/parser-client";
import type {
	ServerMessage,
	WorkspaceState,
} from "../../src/worker/workspace/workspace-types";

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
			color: "yellow",
			text: "#users owns login identity",
		},
	],
	baseline: null,
	updatedAt: 200,
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

interface AgentFake {
	readonly api: WorkspaceAgentApi;
	readonly broadcasts: ServerMessage[];
	readonly state: () => WorkspaceState | null;
}

const createAgentFake = (
	initial: WorkspaceState | null,
	canvasConnections: number,
): AgentFake => {
	let state = initial ? { ...initial, notes: [...initial.notes] } : null;
	const broadcasts: ServerMessage[] = [];
	const api: WorkspaceAgentApi = {
		get state() {
			return state;
		},
		get canvasPresence() {
			return presence(canvasConnections);
		},
		mutate(partial) {
			if (!state) return;
			state = { ...state, ...partial, updatedAt: 300 };
		},
		broadcast(message) {
			broadcasts.push(message);
		},
	};
	return {
		api,
		broadcasts,
		state: () => state,
	};
};

const readPayload = (result: { content: readonly [{ readonly text: string }] }) =>
	JSON.parse(result.content[0].text) as Record<string, unknown>;

const runTool = async (
	workspace: WorkspaceState | null,
	input: SchemaApplyPatchInput,
	respond?: (source: string) => ReturnType<ParserClient["parseSchemaSource"]>,
	canvasConnections = 1,
) => {
	const fake = createAgentFake(workspace, canvasConnections);
	const parser = stubParserClient(respond);
	const context = createWorkspaceMcpContext({
		agent: fake.api,
		parserClient: parser.client,
	});

	const result = await runSchemaApplyPatchTool(
		{ context, agent: fake.api },
		input,
	);

	return {
		result,
		payload: readPayload(result),
		fake,
		broadcasts: fake.broadcasts,
		parser,
	};
};

describe("schema_apply_patch", () => {
	it("requires an active durable Workspace", async () => {
		const { result, payload, broadcasts, parser } = await runTool(null, {
			knownSourceUpdatedAt: 200,
			patches: [
				{
					expectedCurrentText: "  email text",
					replacementText: "  email text\n  phone text",
				},
			],
		});

		expect(result.isError).toBe(true);
		expect(broadcasts).toEqual([]);
		expect(parser.calls).toEqual([]);
		expect(payload).toMatchObject({
			ok: false,
			reason: "workspace_not_active",
		});
	});

	it("requires Canvas Presence before applying a Schema Source Patch", async () => {
		const { result, payload, fake, broadcasts, parser } = await runTool(
			baseWorkspace,
			{
				knownSourceUpdatedAt: 200,
				patches: [
					{
						expectedCurrentText: "  email text",
						replacementText: "  email text\n  phone text",
					},
				],
			},
			undefined,
			0,
		);

		expect(result.isError).toBe(true);
		expect(fake.state()?.source).toBe(baseWorkspace.source);
		expect(broadcasts).toEqual([]);
		expect(parser.calls).toEqual([]);
		expect(payload).toMatchObject({
			ok: false,
			reason: "canvas_not_connected",
		});
	});

	it("applies one exact Schema Source Patch and mutates only Schema Source", async () => {
		const { result, payload, fake, broadcasts, parser } = await runTool(
			baseWorkspace,
			{
				knownSourceUpdatedAt: 200,
				patches: [
					{
						expectedCurrentText: "  email text",
						replacementText: "  email text\n  phone text",
					},
				],
			},
		);

		expect(result.isError).toBeUndefined();
		expect(fake.state()?.source).toContain("  phone text");
		expect(fake.state()?.positions).toEqual(baseWorkspace.positions);
		expect(fake.state()?.notes).toEqual(baseWorkspace.notes);
		expect(fake.state()?.updatedAt).toBe(300);
		expect(broadcasts).toEqual([]);
		expect(parser.calls).toEqual([fake.state()?.source]);
		expect(payload).toMatchObject({
			ok: true,
			freshness: { updatedAt: 300 },
			changes: [
				{
					patchIndex: 0,
					startLine: 3,
					endLine: 4,
					oldLength: "  email text".length,
					newLength: "  email text\n  phone text".length,
				},
			],
			diagnostics: [],
		});
	});

	it("applies multiple valid patches in one atomic source update", async () => {
		const { result, payload, fake, broadcasts, parser } = await runTool(
			baseWorkspace,
			{
				knownSourceUpdatedAt: 200,
				patches: [
					{
						expectedCurrentText: "  email text",
						replacementText: "  email text\n  phone text",
					},
					{
						expectedCurrentText: "  user_id int",
						replacementText: "  user_id int\n  status text",
					},
				],
			},
		);

		expect(result.isError).toBeUndefined();
		expect(fake.state()?.source).toContain("  phone text");
		expect(fake.state()?.source).toContain("  status text");
		expect(broadcasts).toEqual([]);
		expect(parser.calls).toEqual([fake.state()?.source]);
		expect(payload).toMatchObject({
			ok: true,
			changes: [{ patchIndex: 0 }, { patchIndex: 1 }],
			diagnostics: [],
		});
	});

	it("rejects stale Workspace freshness without changing Schema Source", async () => {
		const { result, payload, fake, broadcasts, parser } = await runTool(
			baseWorkspace,
			{
				knownSourceUpdatedAt: 199,
				patches: [
					{
						expectedCurrentText: "  email text",
						replacementText: "  email text\n  phone text",
					},
				],
			},
		);

		expect(result.isError).toBe(true);
		expect(fake.state()?.source).toBe(baseWorkspace.source);
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

	it("rejects a missing expectedCurrentText without changing Schema Source", async () => {
		const { result, payload, fake, broadcasts, parser } = await runTool(
			baseWorkspace,
			{
				knownSourceUpdatedAt: 200,
				patches: [
					{
						expectedCurrentText: "  missing_column text",
						replacementText: "  missing_column text\n  phone text",
					},
				],
			},
		);

		expect(result.isError).toBe(true);
		expect(fake.state()?.source).toBe(baseWorkspace.source);
		expect(broadcasts).toEqual([]);
		expect(parser.calls).toEqual([]);
		expect(payload).toMatchObject({
			ok: false,
			reason: "expected_text_missing",
			patchIndex: 0,
			recovery: expect.stringContaining("schema_source_slice"),
		});
	});

	it("rejects ambiguous expectedCurrentText without changing Schema Source", async () => {
		const { result, payload, fake, broadcasts, parser } = await runTool(
			baseWorkspace,
			{
				knownSourceUpdatedAt: 200,
				patches: [
					{
						expectedCurrentText: "  id int [pk]",
						replacementText: "  id int [pk]\n  created_at timestamp",
					},
				],
			},
		);

		expect(result.isError).toBe(true);
		expect(fake.state()?.source).toBe(baseWorkspace.source);
		expect(broadcasts).toEqual([]);
		expect(parser.calls).toEqual([]);
		expect(payload).toMatchObject({
			ok: false,
			reason: "expected_text_ambiguous",
			patchIndex: 0,
			occurrenceCount: 2,
			recovery: expect.stringContaining("narrower"),
		});
	});

	it("applies multiple patches atomically when one patch is invalid", async () => {
		const { result, payload, fake, broadcasts, parser } = await runTool(
			baseWorkspace,
			{
				knownSourceUpdatedAt: 200,
				patches: [
					{
						expectedCurrentText: "  email text",
						replacementText: "  email text\n  phone text",
					},
					{
						expectedCurrentText: "  missing_column text",
						replacementText: "  missing_column text\n  status text",
					},
				],
			},
		);

		expect(result.isError).toBe(true);
		expect(fake.state()?.source).toBe(baseWorkspace.source);
		expect(broadcasts).toEqual([]);
		expect(parser.calls).toEqual([]);
		expect(payload).toMatchObject({
			ok: false,
			reason: "expected_text_missing",
			patchIndex: 1,
		});
	});

	it("rejects a parser-invalid patch without changing Schema Source or broadcasting", async () => {
		const diagnostics = [
			{ message: "Expected '}'", location: { start: { line: 4, column: 1 } } },
		];
		const { result, payload, fake, broadcasts, parser } = await runTool(
			baseWorkspace,
			{
				knownSourceUpdatedAt: 200,
				patches: [
					{
						expectedCurrentText: "Table users {\n  id int [pk]\n  email text\n}",
						replacementText: "Table users {\n  id int [pk]\n  email text",
					},
				],
			},
			async () => Result.err(new ParserSyntaxError(diagnostics)),
		);

		expect(result.isError).toBe(true);
		expect(fake.state()?.source).toBe(baseWorkspace.source);
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
			recovery: expect.stringContaining("schema_apply_patch"),
		});
		expect(JSON.stringify(payload)).not.toMatch(/parser service/i);
	});
});
