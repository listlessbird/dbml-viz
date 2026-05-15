import { env, exports } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { describe, expect, it } from "vitest";

import { SchemaWorkspace } from "../../../src/worker";
import type {
	ServerMessage,
	WorkspaceSeed,
	WorkspaceState,
} from "../../../src/worker/workspace/workspace-types";

const worker = exports.default;

const seed: WorkspaceSeed = {
	source: "Table browser { id int [pk] }",
	positions: { browser: { x: 10, y: 20 } },
	notes: [
		{
			id: "sticky-1",
			color: "blue",
			text: "Browser seed note.",
		},
	],
	baseline: { shareId: "share-1" },
};

const newerRemote: WorkspaceState = {
	source: "Table remote { id int [pk] }",
	positions: { remote: { x: 30, y: 40 } },
	notes: [],
	baseline: null,
	updatedAt: 300,
};

const workspaceStub = () => {
	const id = env.SchemaWorkspace.idFromName(`workspace-${crypto.randomUUID()}`);
	return env.SchemaWorkspace.get(id);
};

const namedWorkspaceStub = (name: string) => {
	const id = env.SchemaWorkspace.idFromName(name);
	return env.SchemaWorkspace.get(id);
};

const connection = () => {
	const sent: ServerMessage[] = [];
	return {
		api: {
			send(raw: string) {
				sent.push(JSON.parse(raw) as ServerMessage);
			},
		},
		sent,
	};
};

describe("SchemaWorkspace Durable Object runtime", () => {
	it("attaches browser state into durable workspace state", async () => {
		const stub = workspaceStub();

		const state = await runInDurableObject<SchemaWorkspace, WorkspaceState | null>(
			stub,
			async (workspace) => {
				await workspace.onMessage(connection().api as never, JSON.stringify({
					type: "attach",
					state: seed,
					updatedAt: 200,
				}));

				return workspace.state;
			},
		);

		expect(state).toEqual({
			source: seed.source,
			positions: seed.positions,
			notes: seed.notes,
			baseline: seed.baseline,
			updatedAt: 200,
		});
	});

	it("keeps newer durable state when an older browser attach arrives", async () => {
		const stub = workspaceStub();

		const state = await runInDurableObject<SchemaWorkspace, WorkspaceState | null>(
			stub,
			async (workspace) => {
				workspace.setState(newerRemote);
				await workspace.onMessage(connection().api as never, JSON.stringify({
					type: "attach",
					state: seed,
					updatedAt: 200,
				}));

				return workspace.state;
			},
		);

		expect(state).toEqual(newerRemote);
	});

	it("returns an error message for malformed browser messages", async () => {
		const stub = workspaceStub();

		const sent = await runInDurableObject<SchemaWorkspace, ServerMessage[]>(
			stub,
			async (workspace) => {
				const fakeConnection = connection();
				await workspace.onMessage(fakeConnection.api as never, "not-json");

				return fakeConnection.sent;
			},
		);

		expect(sent).toEqual([{ type: "error", message: "Invalid message" }]);
	});

	it("serves read-only MCP tools over the Worker route", async () => {
		const workspaceName = `workspace-${crypto.randomUUID()}`;
		const stub = namedWorkspaceStub(workspaceName);
		await runInDurableObject<SchemaWorkspace, void>(stub, async (workspace) => {
			workspace.setState({
				source: seed.source,
				positions: seed.positions,
				notes: [...seed.notes],
				baseline: seed.baseline,
				updatedAt: 200,
			});
		});

		const transport = new StreamableHTTPClientTransport(
			new URL(
				`https://dbml-viz.test/api/agent/schema-workspace/${workspaceName}/mcp`,
			),
			{
				fetch: (input, init) => {
					const request = new Request(input, init);
					return worker.fetch(request);
				},
			},
		);
		const client = new Client({ name: "worker-runtime-test", version: "1.0.0" });

		await client.connect(transport);
		try {
			const tools = await client.listTools();
			expect(tools.tools.map((tool) => tool.name)).toContain("workspace_status");

			const result = await client.callTool({
				name: "workspace_status",
				arguments: {},
			});

			expect(result.isError).toBeFalsy();
			expect(result.structuredContent).toMatchObject({
				ok: true,
				status: {
					workspaceActive: true,
					canvasPresence: { connected: false, connectionCount: 0 },
					tableCount: 1,
					refCount: 0,
					diagnosticCount: 0,
					updatedAt: 200,
				},
			});
		} finally {
			await client.close();
		}
	});
});
