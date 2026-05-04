import { describe, expect, it } from "vitest";

import {
	createDiagramSessionStore,
} from "@/diagram-session/diagram-session-store";
import type { ParsedSchema } from "@/types";

const usersOnly: ParsedSchema = {
	tables: [
		{ id: "users", name: "users", columns: [], indexes: [] },
	],
	refs: [],
	errors: [],
};

const usersAndOrders: ParsedSchema = {
	tables: [
		{ id: "users", name: "users", columns: [], indexes: [] },
		{ id: "orders", name: "orders", columns: [], indexes: [] },
	],
	refs: [],
	errors: [],
};

const renamedUsers: ParsedSchema = {
	tables: [
		{ id: "people", name: "people", columns: [], indexes: [] },
	],
	refs: [],
	errors: [],
};

describe("Diagram Session parse-result commands", () => {
	it("replaces Parsed Schema and clears diagnostics on parse success", () => {
		const store = createDiagramSessionStore();

		store.getState().applyParseResult({
			ok: false,
			diagnostics: [{ message: "boom" }],
		});

		store.getState().applyParseResult({
			ok: true,
			parsedSchema: usersAndOrders,
			metadata: { format: "dbml" },
		});

		expect(store.getState().diagram.parsedSchema).toBe(usersAndOrders);
		expect(store.getState().sourceMetadata).toEqual({ format: "dbml" });
		expect(store.getState().parseDiagnostics).toEqual([]);
	});

	it("preserves SQL Source metadata from parse success", () => {
		const store = createDiagramSessionStore();

		store.getState().applyParseResult({
			ok: true,
			parsedSchema: usersOnly,
			metadata: { format: "sql", dialect: "mysql" },
		});

		expect(store.getState().sourceMetadata).toEqual({
			format: "sql",
			dialect: "mysql",
		});
	});

	it("prunes Table Positions for Tables removed from the new Parsed Schema", () => {
		const store = createDiagramSessionStore();

		store.getState().applyParseResult({
			ok: true,
			parsedSchema: usersAndOrders,
			metadata: { format: "dbml" },
		});
		store.getState().commitTablePositions({
			users: { x: 10, y: 20 },
			orders: { x: 200, y: 30 },
		});

		store.getState().applyParseResult({
			ok: true,
			parsedSchema: usersOnly,
			metadata: { format: "dbml" },
		});

		expect(store.getState().diagram.tablePositions).toEqual({
			users: { x: 10, y: 20 },
		});
	});

	it("records diagnostics and preserves last good Parsed Schema on parse failure", () => {
		const store = createDiagramSessionStore();

		store.getState().applyParseResult({
			ok: true,
			parsedSchema: usersAndOrders,
			metadata: { format: "dbml" },
		});
		store.getState().commitTablePositions({ users: { x: 10, y: 20 } });

		store.getState().applyParseResult({
			ok: false,
			diagnostics: [{ message: "Unexpected token" }],
		});

		expect(store.getState().diagram.parsedSchema).toBe(usersAndOrders);
		expect(store.getState().diagram.tablePositions).toEqual({
			users: { x: 10, y: 20 },
		});
		expect(store.getState().parseDiagnostics).toEqual([
			{ message: "Unexpected token" },
		]);
	});

	it("replaces older diagnostics on a later parse failure", () => {
		const store = createDiagramSessionStore();

		store.getState().applyParseResult({
			ok: false,
			diagnostics: [{ message: "first error" }],
		});
		store.getState().applyParseResult({
			ok: false,
			diagnostics: [{ message: "second error" }],
		});

		expect(store.getState().parseDiagnostics).toEqual([
			{ message: "second error" },
		]);
	});

	it("does not inherit Table Positions across renamed Tables", () => {
		const store = createDiagramSessionStore();

		store.getState().replaceParsedSchema(usersOnly);
		store.getState().commitTablePositions({ users: { x: 10, y: 20 } });
		store.getState().replaceParsedSchema(renamedUsers);

		expect(store.getState().diagram.tablePositions).toEqual({});
	});

	it("ignores Table Position commits for ids absent from the Parsed Schema", () => {
		const store = createDiagramSessionStore();

		store.getState().replaceParsedSchema(usersOnly);
		store.getState().commitTablePositions({
			users: { x: 10, y: 20 },
			orders: { x: 200, y: 30 },
		});

		expect(store.getState().diagram.tablePositions).toEqual({
			users: { x: 10, y: 20 },
		});
	});
});
