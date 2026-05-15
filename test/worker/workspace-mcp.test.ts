import { describe, expect, it } from "vitest";
import { Result } from "better-result";

import {
	createWorkspaceMcpContext,
	describeWorkspaceAvailability,
	type CanvasPresence,
	type WorkspaceAgentApi,
} from "../../src/worker/workspace/mcp/context";
import { toWorkspaceMcpResult } from "../../src/worker/workspace/mcp/result";
import {
	createSchemaOverviewPayload,
	deriveSchemaOverview,
	runSchemaOverviewTool,
} from "../../src/worker/workspace/mcp/tools/schema-overview";
import { runWorkspaceStatusTool } from "../../src/worker/workspace/mcp/tools/workspace-status";
import { runSchemaEditTool } from "../../src/worker/workspace/mcp/tools/schema-edit";
import {
	ParserSyntaxError,
	ParserUnreachableError,
	type ParserClient,
} from "../../src/worker/lib/parser-client";
import type { WorkspaceState } from "../../src/worker/workspace/workspace-types";
import type { ParsedSchema } from "@/types";

const workspace: WorkspaceState = {
	source: "Table users { id int }",
	positions: { users: { x: 10, y: 20 } },
	notes: [],
	baseline: null,
	updatedAt: 200,
};

const presence = (connectionCount: number): CanvasPresence => ({
	connected: connectionCount > 0,
	connectionCount,
});

const neverCalledParser: ParserClient = {
	parseSchemaSource: async () => {
		throw new Error("parser must not be invoked from availability paths");
	},
};

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

const readPayload = (result: { content: readonly [{ readonly text: string }] }) =>
	JSON.parse(result.content[0].text) as Record<string, unknown>;

describe("Workspace MCP result contract", () => {
	it("returns structured content with a serialized JSON text fallback", () => {
		const payload = {
			ok: true,
			status: describeWorkspaceAvailability(workspace, presence(2)),
		};

		const result = toWorkspaceMcpResult(Result.ok(payload));

		expect(result.structuredContent).toEqual(payload);
		expect(result.content).toEqual([
			{ type: "text", text: JSON.stringify(payload, null, 2) },
		]);
	});
});

const parsedSchema: ParsedSchema = {
	tables: [
		{
			id: "users",
			name: "users",
			columns: [
				{
					name: "id",
					type: "int",
					pk: true,
					notNull: true,
					unique: true,
					isForeignKey: false,
					isIndexed: true,
				},
				{
					name: "email",
					type: "text",
					pk: false,
					notNull: true,
					unique: true,
					isForeignKey: false,
					isIndexed: false,
				},
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
};

describe("Schema overview", () => {
	it("derives compact tables, columns, and relationships from a Parsed Schema", () => {
		const overview = deriveSchemaOverview(parsedSchema);

		expect(overview).toEqual({
			tables: [
				{
					id: "users",
					name: "users",
					columns: ["id", "email"],
				},
			],
			relationships: [
				{
					id: "orders:user_id->users:id:0",
					from: { table: "orders", columns: ["user_id"] },
					to: { table: "users", columns: ["id"] },
					type: "many_to_one",
				},
			],
		});
	});

	it("shapes a payload from parser output without leaking Schema Source", () => {
		const overview = deriveSchemaOverview(parsedSchema);
		const diagnostics = [{ message: "Expected table body" }];

		const payload = createSchemaOverviewPayload({
			updatedAt: workspace.updatedAt,
			overview,
			diagnostics,
		});

		expect(payload).toMatchObject({
			ok: true,
			freshness: { updatedAt: 200 },
			counts: { tables: 1, relationships: 1, diagnostics: 1 },
			tables: [
				{
					id: "users",
					name: "users",
					columns: ["id", "email"],
				},
			],
			relationships: [
				{
					id: "orders:user_id->users:id:0",
					from: { table: "orders", columns: ["user_id"] },
					to: { table: "users", columns: ["id"] },
					type: "many_to_one",
				},
			],
			diagnostics: [{ message: "Expected table body" }],
		});
		expect(JSON.stringify(payload)).not.toContain(workspace.source);
	});
});

describe("Workspace MCP context", () => {
	it("describes durable Workspace availability separately from Canvas Presence", () => {
		expect(describeWorkspaceAvailability(workspace, presence(0))).toEqual({
			workspaceActive: true,
			canvasPresence: { connected: false, connectionCount: 0 },
			updatedAt: 200,
		});

		expect(describeWorkspaceAvailability(null, presence(1))).toEqual({
			workspaceActive: false,
			canvasPresence: { connected: true, connectionCount: 1 },
			updatedAt: null,
		});
	});

	it("lets tools inspect an existing Workspace with Canvas Presence", async () => {
		const context = createWorkspaceMcpContext({
			agent: createAgentApi(workspace, 2),
			parserClient: neverCalledParser,
		});

		const result = await context.requireWorkspace({
			requireCanvasPresence: true,
		});

		expect(Result.isOk(result)).toBe(true);
		if (Result.isOk(result)) {
			expect(result.value.status).toEqual({
				workspaceActive: true,
				canvasPresence: { connected: true, connectionCount: 2 },
				updatedAt: 200,
			});
		}
	});

	it("lets read-only tools inspect an existing Workspace without Canvas Presence", async () => {
		const context = createWorkspaceMcpContext({
			agent: createAgentApi(workspace, 0),
			parserClient: neverCalledParser,
		});

		const result = await context.requireWorkspace();

		expect(Result.isOk(result)).toBe(true);
		if (Result.isOk(result)) {
			expect(result.value.status.canvasPresence.connected).toBe(false);
			expect(result.value.workspace).toBe(workspace);
		}
	});

	it("rejects Canvas-bound tools when the Workspace has no Canvas Presence", async () => {
		const context = createWorkspaceMcpContext({
			agent: createAgentApi(workspace, 0),
			parserClient: neverCalledParser,
		});

		const result = await context.requireWorkspace({ requireCanvasPresence: true });

		expect(Result.isError(result)).toBe(true);
		if (Result.isError(result)) {
			expect(result.error._tag).toBe("CanvasNotConnectedError");
			const toolResult = context.createAvailabilityErrorResult(result.error);

			expect(toolResult.isError).toBe(true);
			expect(toolResult.structuredContent).toMatchObject({
				message:
					"The Workspace exists, but no browser Canvas is currently connected.",
				recovery:
					"Ask the user to reconnect the Canvas, then retry the Canvas-bound tool.",
			});
			expect(readPayload(toolResult)).toMatchObject({
				ok: false,
				reason: "canvas_not_connected",
				status: {
					workspaceActive: true,
					canvasPresence: { connected: false, connectionCount: 0 },
				},
			});
		}
	});

	it("rejects tools when no durable Workspace exists", async () => {
		const context = createWorkspaceMcpContext({
			agent: createAgentApi(null, 0),
			parserClient: neverCalledParser,
		});

		const result = await context.requireWorkspace();

		expect(Result.isError(result)).toBe(true);
		if (Result.isError(result)) {
			expect(result.error._tag).toBe("WorkspaceNotActiveError");

			expect(
				readPayload(context.createAvailabilityErrorResult(result.error)),
			).toMatchObject({
				ok: false,
				reason: "workspace_not_active",
				status: { workspaceActive: false },
			});
		}
	});
});

const createStubParserClient = (
	respond: (source: string) => ReturnType<ParserClient["parseSchemaSource"]>,
): { client: ParserClient; calls: string[] } => {
	const calls: string[] = [];
	return {
		client: {
			parseSchemaSource: async (source: string) => {
				calls.push(source);
				return respond(source);
			},
		},
		calls,
	};
};

const buildContext = (params: {
	state: WorkspaceState | null;
	canvasConnections: number;
	parserClient: ParserClient;
}) =>
	createWorkspaceMcpContext({
		agent: createAgentApi(params.state, params.canvasConnections),
		parserClient: params.parserClient,
	});

describe("runSchemaOverviewTool", () => {
	it("calls the parser with the durable Workspace source and returns derived overview", async () => {
		const { client, calls } = createStubParserClient(async () =>
			Result.ok({ parsed: parsedSchema, metadata: { format: "dbml" } }),
		);
		const context = buildContext({
			state: workspace,
			canvasConnections: 0,
			parserClient: client,
		});

		const result = await runSchemaOverviewTool(context);

		expect(calls).toEqual([workspace.source]);
		expect(result.isError).toBeUndefined();
		expect(readPayload(result)).toMatchObject({
			ok: true,
			freshness: { updatedAt: 200 },
			counts: { tables: 1, relationships: 1, diagnostics: 0 },
			tables: [{ id: "users", name: "users", columns: ["id", "email"] }],
			relationships: [
				{
					id: "orders:user_id->users:id:0",
					from: { table: "orders", columns: ["user_id"] },
					type: "many_to_one",
				},
			],
			diagnostics: [],
		});
	});

	it("works without Canvas Presence on a durable Workspace", async () => {
		const { client } = createStubParserClient(async () =>
			Result.ok({ parsed: parsedSchema, metadata: { format: "dbml" } }),
		);
		const context = buildContext({
			state: workspace,
			canvasConnections: 0,
			parserClient: client,
		});

		const result = await runSchemaOverviewTool(context);

		expect(result.isError).toBeUndefined();
		expect(readPayload(result)).toMatchObject({ ok: true });
	});

	it("returns parser diagnostics with empty overview when the source fails to parse", async () => {
		const diagnostics = [
			{ message: "Expected '}'", location: { start: { line: 2, column: 1 } } },
		];
		const { client } = createStubParserClient(async () =>
			Result.err(new ParserSyntaxError(diagnostics)),
		);
		const context = buildContext({
			state: workspace,
			canvasConnections: 0,
			parserClient: client,
		});

		const result = await runSchemaOverviewTool(context);

		expect(result.isError).toBeUndefined();
		expect(readPayload(result)).toMatchObject({
			ok: true,
			tables: [],
			relationships: [],
			diagnostics,
			counts: { tables: 0, relationships: 0, diagnostics: 1 },
		});
	});

	it("does not return Schema Source in any successful path", async () => {
		const { client } = createStubParserClient(async () =>
			Result.ok({ parsed: parsedSchema, metadata: { format: "dbml" } }),
		);
		const context = buildContext({
			state: workspace,
			canvasConnections: 0,
			parserClient: client,
		});

		const result = await runSchemaOverviewTool(context);

		expect(JSON.stringify(result)).not.toContain(workspace.source);
	});

	it("returns workspace_not_active error when no durable Workspace exists", async () => {
		const { client, calls } = createStubParserClient(async () =>
			Result.ok({ parsed: parsedSchema, metadata: { format: "dbml" } }),
		);
		const context = buildContext({
			state: null,
			canvasConnections: 0,
			parserClient: client,
		});

		const result = await runSchemaOverviewTool(context);

		expect(result.isError).toBe(true);
		expect(calls).toEqual([]);
		expect(readPayload(result)).toMatchObject({
			ok: false,
			reason: "workspace_not_active",
		});
	});

	it("surfaces parser_unreachable as a tool execution error with recovery guidance", async () => {
		const { client } = createStubParserClient(async () =>
			Result.err(new ParserUnreachableError(new Error("boom"))),
		);
		const context = buildContext({
			state: workspace,
			canvasConnections: 0,
			parserClient: client,
		});

		const result = await runSchemaOverviewTool(context);

		expect(result.isError).toBe(true);
		expect(readPayload(result)).toMatchObject({
			ok: false,
			reason: "parser_unavailable",
			recovery: expect.stringContaining("Retry"),
			status: { workspaceActive: true },
		});
	});
});

describe("runWorkspaceStatusTool", () => {
	it("computes counts from the parser, not from durable Workspace state", async () => {
		const parsedSchemaWithThreeTables: ParsedSchema = {
			tables: [
				{ id: "a", name: "a", columns: [], indexes: [] },
				{ id: "b", name: "b", columns: [], indexes: [] },
				{ id: "c", name: "c", columns: [], indexes: [] },
			],
			refs: [
				{
					id: "a->b",
					from: { table: "a", columns: ["bid"] },
					to: { table: "b", columns: ["id"] },
					type: "many_to_one",
				},
				{
					id: "b->c",
					from: { table: "b", columns: ["cid"] },
					to: { table: "c", columns: ["id"] },
					type: "many_to_one",
				},
			],
			errors: [],
		};
		const { client } = createStubParserClient(async () =>
			Result.ok({ parsed: parsedSchemaWithThreeTables, metadata: { format: "dbml" } }),
		);
		const context = buildContext({
			state: workspace,
			canvasConnections: 0,
			parserClient: client,
		});

		const result = await runWorkspaceStatusTool(context);

		expect(result.isError).toBeUndefined();
		expect(readPayload(result)).toMatchObject({
			ok: true,
			status: {
				workspaceActive: true,
				updatedAt: 200,
				tableCount: 3,
				refCount: 2,
				diagnosticCount: 0,
			},
		});
	});

	it("reports diagnosticCount when the parser returns ParserSyntaxError, without leaking diagnostic content", async () => {
		const diagnostics = [
			{ message: "Expected '}'", location: { start: { line: 2, column: 1 } } },
			{ message: "Unknown token", location: { start: { line: 5, column: 3 } } },
		];
		const { client } = createStubParserClient(async () =>
			Result.err(new ParserSyntaxError(diagnostics)),
		);
		const context = buildContext({
			state: workspace,
			canvasConnections: 0,
			parserClient: client,
		});

		const result = await runWorkspaceStatusTool(context);

		expect(result.isError).toBeUndefined();
		const payload = readPayload(result);
		expect(payload).toMatchObject({
			ok: true,
			status: {
				workspaceActive: true,
				tableCount: 0,
				refCount: 0,
				diagnosticCount: 2,
			},
		});
		expect(payload).not.toHaveProperty("diagnostics");
		expect(JSON.stringify(payload)).not.toContain("Expected '}'");
	});

	it("surfaces parser_unreachable as a tool execution error embedding the cheap availability status", async () => {
		const { client } = createStubParserClient(async () =>
			Result.err(new ParserUnreachableError(new Error("boom"))),
		);
		const context = buildContext({
			state: workspace,
			canvasConnections: 0,
			parserClient: client,
		});

		const result = await runWorkspaceStatusTool(context);

		expect(result.isError).toBe(true);
		expect(readPayload(result)).toMatchObject({
			ok: false,
			reason: "parser_unavailable",
			recovery: expect.stringContaining("Retry"),
			status: {
				workspaceActive: true,
				canvasPresence: { connected: false, connectionCount: 0 },
				updatedAt: 200,
			},
		});
	});

	it("returns workspace_not_active without calling the parser when no durable Workspace exists", async () => {
		const { client, calls } = createStubParserClient(async () =>
			Result.ok({ parsed: parsedSchema, metadata: { format: "dbml" } }),
		);
		const context = buildContext({
			state: null,
			canvasConnections: 0,
			parserClient: client,
		});

		const result = await runWorkspaceStatusTool(context);

		expect(result.isError).toBe(true);
		expect(calls).toEqual([]);
		expect(readPayload(result)).toMatchObject({
			ok: false,
			reason: "workspace_not_active",
			status: { workspaceActive: false },
		});
	});

	it("succeeds without Canvas Presence", async () => {
		const { client } = createStubParserClient(async () =>
			Result.ok({ parsed: parsedSchema, metadata: { format: "dbml" } }),
		);
		const context = buildContext({
			state: workspace,
			canvasConnections: 0,
			parserClient: client,
		});

		const result = await runWorkspaceStatusTool(context);

		expect(result.isError).toBeUndefined();
		expect(readPayload(result)).toMatchObject({
			ok: true,
			status: { canvasPresence: { connected: false, connectionCount: 0 } },
		});
	});
});

describe("Regression: schema_edit then workspace_status", () => {
	const initialSource = "Table users { id int }";
	const expandedSource = "Table users { id int }\nTable orders { id int }";

	const createMutableAgent = (
		state: WorkspaceState,
		canvasConnections: number,
	) => {
		let current: WorkspaceState | null = { ...state };
		const api: WorkspaceAgentApi = {
			get state() {
				return current;
			},
			get canvasPresence() {
				return presence(canvasConnections);
			},
			mutate(partial) {
				if (!current) return;
				current = { ...current, ...partial, updatedAt: 300 };
			},
			broadcast() {},
		};
		return {
			api,
			get state() {
				return current;
			},
		};
	};

	const parsedFromSource = (source: string): ParsedSchema => {
		const tables = (source.match(/Table\s+\w+/g) ?? []).map((match, i) => ({
			id: `t-${i}`,
			name: match.split(/\s+/)[1] ?? `t-${i}`,
			columns: [],
			indexes: [],
		}));
		return { tables, refs: [], errors: [] };
	};

	it("workspace_status reflects the new tableCount after a schema_edit adds a Table", async () => {
		const mutable = createMutableAgent(
			{
				source: initialSource,
				positions: {},
				notes: [],
				baseline: null,
				updatedAt: 200,
			},
			1,
		);
		const parserClient: ParserClient = {
			parseSchemaSource: async (source) =>
				Result.ok({
					parsed: parsedFromSource(source),
					metadata: { format: "dbml" },
					sourceRanges: null,
				}),
		};
		const context = createWorkspaceMcpContext({
			agent: mutable.api,
			parserClient,
		});

		const beforeStatus = readPayload(await runWorkspaceStatusTool(context));
		expect(beforeStatus).toMatchObject({
			ok: true,
			status: { tableCount: 1 },
		});

		const editResult = await runSchemaEditTool(
			{ context, agent: mutable.api },
			{
				knownSourceUpdatedAt: 200,
				oldString: "",
				newString: expandedSource,
			},
		);
		expect(editResult.isError).toBeUndefined();
		expect(mutable.state?.source).toBe(expandedSource);

		const afterStatus = readPayload(await runWorkspaceStatusTool(context));
		expect(afterStatus).toMatchObject({
			ok: true,
			status: { tableCount: 2 },
		});
	});
});

describe("Availability error envelope is parser-free", () => {
	const throwingParser: ParserClient = {
		parseSchemaSource: async () => {
			throw new Error("parser must not be invoked on availability error paths");
		},
	};

	it("does not invoke the parser when no durable Workspace exists (workspace_status path)", async () => {
		const context = buildContext({
			state: null,
			canvasConnections: 1,
			parserClient: throwingParser,
		});

		const result = await runWorkspaceStatusTool(context);

		expect(result.isError).toBe(true);
		expect(readPayload(result)).toMatchObject({
			ok: false,
			reason: "workspace_not_active",
		});
	});

	it("does not invoke the parser when no durable Workspace exists (schema_overview path)", async () => {
		const context = buildContext({
			state: null,
			canvasConnections: 1,
			parserClient: throwingParser,
		});

		const result = await runSchemaOverviewTool(context);

		expect(result.isError).toBe(true);
		expect(readPayload(result)).toMatchObject({
			ok: false,
			reason: "workspace_not_active",
		});
	});
});
