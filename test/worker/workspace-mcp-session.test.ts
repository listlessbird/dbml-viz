import { describe, expect, it } from "vitest";

import {
	MCP_SESSION_TERMINATED_KEY,
	MCP_TRANSPORT_STATE_KEY,
	WorkspaceMcpSession,
} from "../../src/worker/workspace/mcp/session";
import type { McpClientInfo } from "../../src/worker/workspace/workspace-types";

class MemoryStorage {
	readonly values = new Map<string, unknown>();

	async get<T>(key: string): Promise<T | undefined> {
		return this.values.get(key) as T | undefined;
	}

	async put(value: Record<string, unknown>): Promise<void> {
		for (const [key, entry] of Object.entries(value)) {
			this.values.set(key, entry);
		}
	}

	async delete(key: string): Promise<void> {
		this.values.delete(key);
	}
}

class TrackedTransport {
	closeCalls = 0;

	async close(): Promise<void> {
		this.closeCalls += 1;
	}
}

const requestWithSession = (sessionId: string) =>
	new Request("https://example.com/mcp", {
		headers: { "MCP-Session-Id": sessionId },
	});

describe("Workspace MCP Session Module", () => {
	it("terminates the active MCP session and rejects the old session id", async () => {
		const storage = new MemoryStorage();
		const clientInfo: McpClientInfo = {
			name: "claude-code",
			title: "Claude Code",
			version: "1.0.0",
		};
		await storage.put({
			[MCP_TRANSPORT_STATE_KEY]: {
				sessionId: "session-1",
				initialized: true,
				initializeParams: { clientInfo },
			},
		});
		const session = new WorkspaceMcpSession(storage);
		const transport = new TrackedTransport();
		session.trackTransport(transport);

		expect(await session.rejectTerminatedRequest(requestWithSession("session-1"))).toBeNull();

		const terminated = await session.terminateActiveSession();

		expect(terminated).toEqual({ sessionId: "session-1", clientInfo });
		expect(transport.closeCalls).toBe(1);
		expect(storage.values.get(MCP_TRANSPORT_STATE_KEY)).toBeUndefined();
		expect(storage.values.get(MCP_SESSION_TERMINATED_KEY)).toEqual("session-1");

		const response = await session.rejectTerminatedRequest(
			requestWithSession("session-1"),
		);
		expect(response?.status).toBe(404);
		expect(await response?.json()).toMatchObject({
			error: { message: "Session not found" },
		});
	});
});
