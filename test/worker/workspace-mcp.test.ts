import { describe, expect, it } from "vitest";
import { Result } from "better-result";

import {
	createWorkspaceMcpContext,
	describeWorkspaceMcpStatus,
	type CanvasPresence,
} from "../../src/worker/workspace/mcp/context";
import { toWorkspaceMcpResult } from "../../src/worker/workspace/mcp/result";
import {
	createSchemaOverviewPayload,
	deriveSchemaOverview,
	runSchemaOverviewTool,
} from "../../src/worker/workspace/mcp/tools/schema-overview";
import {
	ParserSyntaxError,
	ParserUnreachableError,
	type ParserClient,
} from "../../src/worker/lib/parser-client";
import type { WorkspaceStorage } from "../../src/worker/workspace/workspace-storage";
import type { WorkspaceState } from "../../src/worker/workspace/workspace-types";
import type { ParsedSchema } from "@/types";

const workspace: WorkspaceState = {
	source: "Table users { id int }",
	positions: { users: { x: 10, y: 20 } },
	notes: [],
	diagnostics: [{ message: "Expected table body" }],
	parsedTableCount: 1,
	parsedRefCount: 0,
	baseline: null,
	createdAt: 100,
	updatedAt: 200,
	lastActivityAt: 200,
};

const presence = (connectionCount: number): CanvasPresence => ({
	connected: connectionCount > 0,
	connectionCount,
});

const createStorage = (state: WorkspaceState | null) => {
	let touchCount = 0;
	const storage = {
		load: async () => state,
		touch: async () => {
			touchCount += 1;
		},
	} as unknown as WorkspaceStorage;

	return {
		storage,
		get touchCount() {
			return touchCount;
		},
	};
};

const readPayload = (result: { content: readonly [{ readonly text: string }] }) =>
	JSON.parse(result.content[0].text) as Record<string, unknown>;

describe("Workspace MCP result contract", () => {
	it("returns structured content with a serialized JSON text fallback", () => {
		const payload = {
			ok: true,
			status: describeWorkspaceMcpStatus(workspace, presence(2)),
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
	it("describes durable Workspace state separately from Canvas Presence", () => {
		expect(describeWorkspaceMcpStatus(workspace, presence(0))).toEqual({
			workspaceActive: true,
			canvasPresence: { connected: false, connectionCount: 0 },
			updatedAt: 200,
			tableCount: 1,
			refCount: 0,
			diagnosticCount: 1,
		});

		expect(describeWorkspaceMcpStatus(null, presence(1))).toEqual({
			workspaceActive: false,
			canvasPresence: { connected: true, connectionCount: 1 },
			updatedAt: null,
			tableCount: 0,
			refCount: 0,
			diagnosticCount: 0,
		});
	});

	it("lets tools inspect an existing Workspace with Canvas Presence", async () => {
		const harness = createStorage(workspace);
		const context = createWorkspaceMcpContext({
			storage: harness.storage,
			getCanvasPresence: () => presence(2),
		});

		const result = await context.requireWorkspace({
			requireCanvasPresence: true,
		});

		expect(Result.isOk(result)).toBe(true);
		expect(harness.touchCount).toBe(1);
		if (Result.isOk(result)) {
			expect(result.value.status).toMatchObject({
				workspaceActive: true,
				canvasPresence: { connected: true, connectionCount: 2 },
				updatedAt: 200,
				tableCount: 1,
				refCount: 0,
				diagnosticCount: 1,
			});
		}
	});

	it("lets read-only tools inspect an existing Workspace without Canvas Presence", async () => {
		const harness = createStorage(workspace);
		const context = createWorkspaceMcpContext({
			storage: harness.storage,
			getCanvasPresence: () => presence(0),
		});

		const result = await context.requireWorkspace();

		expect(Result.isOk(result)).toBe(true);
		expect(harness.touchCount).toBe(1);
		if (Result.isOk(result)) {
			expect(result.value.status.canvasPresence.connected).toBe(false);
			expect(result.value.workspace).toBe(workspace);
		}
	});

	it("rejects Canvas-bound tools when the Workspace has no Canvas Presence", async () => {
		const harness = createStorage(workspace);
		const context = createWorkspaceMcpContext({
			storage: harness.storage,
			getCanvasPresence: () => presence(0),
		});

		const result = await context.requireWorkspace({ requireCanvasPresence: true });

		expect(Result.isError(result)).toBe(true);
		expect(harness.touchCount).toBe(0);
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
		const harness = createStorage(null);
		const context = createWorkspaceMcpContext({
			storage: harness.storage,
			getCanvasPresence: () => presence(0),
		});

		const result = await context.requireWorkspace();

		expect(Result.isError(result)).toBe(true);
		expect(harness.touchCount).toBe(0);
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
		storage: createStorage(params.state).storage,
		getCanvasPresence: () => presence(params.canvasConnections),
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
