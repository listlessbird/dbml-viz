import { describe, expect, it } from "vitest";

import {
	buildColumnActions,
	buildTableActions,
} from "@/components/table-node/schema-element-actions";
import type { SourceFocusStore } from "@/canvas-next/source-focus/source-focus-store";
import type { TableData } from "@/types";

const buildMockSourceFocusStore = () => {
	const calls: Array<{ tableName: string; columnName?: string }> = [];
	const store = {
		getState: () => ({
			requestSourceFocus: (input: { tableName: string; columnName?: string }) => {
				calls.push(input);
			},
		}),
	} as unknown as SourceFocusStore;
	return { store, calls };
};

const stubRuntime = {} as Parameters<typeof buildTableActions>[0]["runtimeStore"];
const stubSession = {} as Parameters<typeof buildTableActions>[0]["sessionStore"];

describe("buildTableActions focus-source action", () => {
	it("passes the bare table name when the Table has no schema", () => {
		const { store, calls } = buildMockSourceFocusStore();
		const table: TableData = { id: "users", name: "users", columns: [], indexes: [] };

		const actions = buildTableActions({
			table,
			runtimeStore: stubRuntime,
			sourceFocusStore: store,
			sessionStore: stubSession,
		});
		actions.find((a) => a.id === "focus-source")!.onSelect();

		expect(calls).toEqual([{ tableName: "users" }]);
	});

	it("passes the schema-qualified name when the Table has a schema", () => {
		const { store, calls } = buildMockSourceFocusStore();
		const table: TableData = {
			id: "public.users",
			name: "users",
			schema: "public",
			columns: [],
			indexes: [],
		};

		const actions = buildTableActions({
			table,
			runtimeStore: stubRuntime,
			sourceFocusStore: store,
			sessionStore: stubSession,
		});
		actions.find((a) => a.id === "focus-source")!.onSelect();

		expect(calls).toEqual([{ tableName: "public.users" }]);
	});
});

describe("buildColumnActions focus-source action", () => {
	it("passes the bare table name when no schema is present", () => {
		const { store, calls } = buildMockSourceFocusStore();

		const actions = buildColumnActions({
			tableName: "users",
			columnName: "id",
			sourceFocusStore: store,
		});
		actions.find((a) => a.id === "focus-source")!.onSelect();

		expect(calls).toEqual([{ tableName: "users", columnName: "id" }]);
	});

	it("passes the schema-qualified table name to the focus action", () => {
		const { store, calls } = buildMockSourceFocusStore();

		const actions = buildColumnActions({
			tableName: "public.users",
			columnName: "id",
			sourceFocusStore: store,
		});
		actions.find((a) => a.id === "focus-source")!.onSelect();

		expect(calls).toEqual([{ tableName: "public.users", columnName: "id" }]);
	});
});
