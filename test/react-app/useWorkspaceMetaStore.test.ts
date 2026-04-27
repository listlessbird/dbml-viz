import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { useWorkspaceMetaStore } from "@/store/useWorkspaceMetaStore";

const STORAGE_KEY = "dbml-visualizer-workspace-meta";

beforeEach(() => {
	window.localStorage.clear();
	useWorkspaceMetaStore.setState({ lastServerUpdatedAt: null });
});

afterEach(() => {
	window.localStorage.clear();
});

describe("useWorkspaceMetaStore", () => {
	it("starts with no recorded server timestamp", () => {
		expect(useWorkspaceMetaStore.getState().lastServerUpdatedAt).toBeNull();
	});

	it("persists the last server-stamped updatedAt to localStorage", () => {
		useWorkspaceMetaStore.getState().setLastServerUpdatedAt(1_700_000_000_000);

		const stored = window.localStorage.getItem(STORAGE_KEY);
		expect(stored).not.toBeNull();
		const parsed = JSON.parse(stored!);
		expect(parsed.state.lastServerUpdatedAt).toBe(1_700_000_000_000);
	});

	it("clears the recorded timestamp", () => {
		useWorkspaceMetaStore.getState().setLastServerUpdatedAt(1_700_000_000_000);
		useWorkspaceMetaStore.getState().clearLastServerUpdatedAt();

		expect(useWorkspaceMetaStore.getState().lastServerUpdatedAt).toBeNull();
	});
});
