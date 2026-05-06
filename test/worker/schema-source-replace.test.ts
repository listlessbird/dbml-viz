import { describe, expect, it } from "vitest";
import { Result } from "better-result";

import { createWorkspaceMcpServer } from "../../src/worker/workspace/mcp/server";
import {
	createWorkspaceMcpContext,
	type CanvasPresence,
} from "../../src/worker/workspace/mcp/context";
import {
	runSchemaReplaceSourceTool,
	type SchemaReplaceSourceInput,
} from "../../src/worker/workspace/mcp/tools/schema-replace-source";
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

const originalSource = [
	"Table users {",
	"  id int [pk]",
	"  email text",
	"}",
].join("\n");

const replacementSource = [
	"Table accounts {",
	"  id int [pk]",
	"  email text",
	"  status text",
	"}",
].join("\n");

const baseWorkspace: WorkspaceState = {
	source: originalSource,
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
	parsedTableCount: 1,
	parsedRefCount: 0,
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
	input: SchemaReplaceSourceInput,
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

	const result = await runSchemaReplaceSourceTool(
		{
			context,
			storage: mutable.storage,
			broadcast: (message) => broadcasts.push(message),
		},
		input,
	);

	return { result, payload: readPayload(result), mutable, broadcasts, parser };
};

describe("schema_replace_source", () => {
	it("requires an active durable Workspace", async () => {
		const { result, payload, broadcasts, parser } = await runTool(null, {
			knownSourceUpdatedAt: 200,
			source: replacementSource,
		});

		expect(result.isError).toBe(true);
		expect(broadcasts).toEqual([]);
		expect(parser.calls).toEqual([]);
		expect(payload).toMatchObject({
			ok: false,
			reason: "workspace_not_active",
		});
	});

	it("requires Canvas Presence before replacing Schema Source", async () => {
		const { result, payload, mutable, broadcasts, parser } = await runTool(
			baseWorkspace,
			{
				knownSourceUpdatedAt: 200,
				source: replacementSource,
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

	it("replaces the full Schema Source and mutates only Schema Source", async () => {
		const { result, payload, mutable, broadcasts, parser } = await runTool(
			baseWorkspace,
			{
				knownSourceUpdatedAt: 200,
				source: replacementSource,
			},
		);

		expect(result.isError).toBeUndefined();
		expect(mutable.state?.source).toBe(replacementSource);
		expect(mutable.state?.positions).toEqual(baseWorkspace.positions);
		expect(mutable.state?.notes).toEqual(baseWorkspace.notes);
		expect(broadcasts).toEqual([
			{
				type: "state-update",
				patch: {
					source: replacementSource,
					updatedAt: 300,
				},
			},
		]);
		expect(parser.calls).toEqual([replacementSource]);
		expect(payload).toMatchObject({
			ok: true,
			freshness: { updatedAt: 300 },
			sourceSize: {
				oldLength: originalSource.length,
				newLength: replacementSource.length,
			},
			diagnostics: [],
		});
	});

	it("rejects stale Workspace freshness without changing Schema Source", async () => {
		const { result, payload, mutable, broadcasts, parser } = await runTool(
			baseWorkspace,
			{
				knownSourceUpdatedAt: 199,
				source: replacementSource,
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
			recovery: expect.stringContaining("schema_replace_source"),
		});
	});

	it("rejects oversized replacement source with recovery guidance", async () => {
		const oversizedSource = "x".repeat(maxSchemaSourceLength + 1);
		const { result, payload, mutable, broadcasts, parser } = await runTool(
			baseWorkspace,
			{
				knownSourceUpdatedAt: 200,
				source: oversizedSource,
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
			recovery: expect.stringContaining("schema_apply_patch"),
		});
	});

	it("rejects a parser-invalid replacement without changing Schema Source or broadcasting", async () => {
		const diagnostics = [
			{ message: "Expected '}'", location: { start: { line: 5, column: 1 } } },
		];
		const { result, payload, mutable, broadcasts, parser } = await runTool(
			baseWorkspace,
			{
				knownSourceUpdatedAt: 200,
				source: replacementSource,
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
			message: expect.stringContaining("syntax or validation errors"),
			diagnostics,
			recovery: expect.stringContaining("schema_replace_source"),
		});
		expect(JSON.stringify(payload)).not.toMatch(/parser service/i);
	});

	it("registers description guidance for explicit full-source workflows", () => {
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

		expect(tools.schema_replace_source?.description).toContain(
			"import, reset, broad redesign",
		);
		expect(tools.schema_replace_source?.description).toContain(
			"Do not use for targeted edits",
		);
		expect(tools.schema_replace_source?.description).toContain(
			"schema_apply_patch",
		);
	});
});
