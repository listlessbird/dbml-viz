import { describe, expect, it } from "vitest";

import { useDiagramUiStore } from "@/store/useDiagramUiStore";

describe("useDiagramUiStore", () => {
	it("normalizes focused table ids and allows clearing them", () => {
		useDiagramUiStore
			.getState()
			.setFocusedTableIds(["orders", "users", "orders", "accounts"]);
		useDiagramUiStore
			.getState()
			.setSelectedTableIds(["users", "accounts", "users"]);

		expect(useDiagramUiStore.getState().focusedTableIds).toEqual([
			"accounts",
			"orders",
			"users",
		]);
		expect(useDiagramUiStore.getState().selectedTableIds).toEqual([
			"accounts",
			"users",
		]);

		useDiagramUiStore.getState().clearFocusedTableIds();
		useDiagramUiStore.getState().clearSelectedTableIds();

		expect(useDiagramUiStore.getState().focusedTableIds).toEqual([]);
		expect(useDiagramUiStore.getState().selectedTableIds).toEqual([]);
	});

	it("persists pan mode while keeping transient selection state out of storage", () => {
		useDiagramUiStore.getState().setPanModeEnabled(true);
		useDiagramUiStore.getState().setFocusedTableIds(["users", "orders"]);
		useDiagramUiStore.getState().setSelectedTableIds(["users"]);
		useDiagramUiStore.getState().setSearchQuery("users");

		const persisted = window.localStorage.getItem("dbml-visualizer-ui");

		expect(persisted).toContain('"panModeEnabled":true');
		expect(persisted).not.toContain("focusedTableIds");
		expect(persisted).not.toContain("selectedTableIds");
		expect(persisted).not.toContain("searchQuery");
	});
});
