import { describe, expect, it } from "vitest";

import { MCP_SESSION_TERMINATED_KEY } from "../../src/worker/workspace/mcp/session";
import { WorkspaceStorage } from "../../src/worker/workspace/workspace-storage";

class MemoryDurableObjectStorage {
	readonly values = new Map<string, unknown>();

	async get<T>(key: string | string[]): Promise<T | Map<string, unknown> | undefined> {
		if (Array.isArray(key)) {
			const values = new Map<string, unknown>();
			for (const entryKey of key) values.set(entryKey, this.values.get(entryKey));
			return values;
		}
		return this.values.get(key) as T | undefined;
	}

	async put(entries: Record<string, unknown>): Promise<void> {
		for (const [key, value] of Object.entries(entries)) {
			this.values.set(key, value);
		}
	}

	async delete(key: string | string[]): Promise<void> {
		for (const entryKey of Array.isArray(key) ? key : [key]) {
			this.values.delete(entryKey);
		}
	}

	async deleteAll(): Promise<void> {
		this.values.clear();
	}
}

describe("Workspace Storage", () => {
	it("clears Workspace state without deleting MCP session tombstones", async () => {
		const storage = new MemoryDurableObjectStorage();
		const workspaceStorage = new WorkspaceStorage(
			storage as unknown as DurableObjectStorage,
		);
		await workspaceStorage.init({
			source: "Table users { id int }",
			positions: { users: { x: 10, y: 20 } },
			notes: [],
			baseline: null,
		});
		await storage.put({ [MCP_SESSION_TERMINATED_KEY]: "session-1" });

		await workspaceStorage.clear();

		expect(await workspaceStorage.load()).toBeNull();
		expect(storage.values.get(MCP_SESSION_TERMINATED_KEY)).toBe("session-1");
	});
});
