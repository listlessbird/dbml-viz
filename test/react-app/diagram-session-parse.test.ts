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
			kind: "failure",
			diagnostics: [{ message: "boom" }],
		});

		store.getState().applyParseResult({
			kind: "success",
			parsedSchema: usersAndOrders,
			metadata: { format: "dbml" },
		});

		expect(store.getState().diagram.parsedSchema).toBe(usersAndOrders);
		expect(store.getState().sourceMetadata).toEqual({ format: "dbml" });
		expect(store.getState().parseDiagnostics).toEqual([]);
	});

	it("seeds missing Table Positions on parse success", () => {
		const store = createDiagramSessionStore();

		store.getState().applyParseResult({
			kind: "success",
			parsedSchema: usersAndOrders,
			metadata: { format: "dbml" },
		});

		expect(Object.keys(store.getState().diagram.tablePositions)).toEqual([
			"users",
			"orders",
		]);
	});

	it("preserves manual Table Positions and seeds only newly added Tables", () => {
		const store = createDiagramSessionStore();

		store.getState().applyParseResult({
			kind: "success",
			parsedSchema: usersOnly,
			metadata: { format: "dbml" },
		});
		store.getState().commitTablePositions({ users: { x: 10, y: 20 } });

		store.getState().applyParseResult({
			kind: "success",
			parsedSchema: usersAndOrders,
			metadata: { format: "dbml" },
		});

		expect(store.getState().diagram.tablePositions.users).toEqual({ x: 10, y: 20 });
		expect(store.getState().diagram.tablePositions.orders).toBeDefined();
	});

	it("exposes added and removed Table ids from parse success", () => {
		const store = createDiagramSessionStore();

		store.getState().applyParseResult({
			kind: "success",
			parsedSchema: usersOnly,
			metadata: { format: "dbml" },
		});
		expect(store.getState().lastParseTableDiff).toEqual({
			addedTableIds: ["users"],
			removedTableIds: [],
		});

		store.getState().applyParseResult({
			kind: "success",
			parsedSchema: usersAndOrders,
			metadata: { format: "dbml" },
		});
		expect(store.getState().lastParseTableDiff).toEqual({
			addedTableIds: ["orders"],
			removedTableIds: [],
		});

		store.getState().applyParseResult({
			kind: "success",
			parsedSchema: usersOnly,
			metadata: { format: "dbml" },
		});
		expect(store.getState().lastParseTableDiff).toEqual({
			addedTableIds: [],
			removedTableIds: ["orders"],
		});
	});

	it("seeds Source metadata from the initial Diagram Session construction", () => {
		const store = createDiagramSessionStore(
			{
				source: "CREATE TABLE users (id int primary key);",
				parsedSchema: { tables: [], refs: [], errors: [] },
				tablePositions: {},
				stickyNotes: [],
			},
			{ format: "sql", dialect: "mysql" },
		);

		expect(store.getState().sourceMetadata).toEqual({
			format: "sql",
			dialect: "mysql",
		});
	});

	it("seeds Source metadata through hydrateDiagram so the editor never drifts from the seeded source", () => {
		const store = createDiagramSessionStore();

		store.getState().hydrateDiagram(
			{
				source: "CREATE TABLE users (id int primary key);",
				parsedSchema: { tables: [], refs: [], errors: [] },
				tablePositions: {},
				stickyNotes: [],
			},
			{ format: "sql", dialect: "mysql" },
		);

		expect(store.getState().sourceMetadata).toEqual({
			format: "sql",
			dialect: "mysql",
		});
	});

	it("seeds missing Table Positions when hydrating a Diagram with a Parsed Schema", () => {
		const store = createDiagramSessionStore();

		store.getState().hydrateDiagram({
			source: "",
			parsedSchema: usersAndOrders,
			tablePositions: { users: { x: 10, y: 20 } },
			stickyNotes: [],
		});

		expect(store.getState().diagram.tablePositions.users).toEqual({ x: 10, y: 20 });
		expect(store.getState().diagram.tablePositions.orders).toBeDefined();
	});

	it("preserves SQL Source metadata from parse success", () => {
		const store = createDiagramSessionStore();

		store.getState().applyParseResult({
			kind: "success",
			parsedSchema: usersOnly,
			metadata: { format: "sql", dialect: "mysql" },
		});

		expect(store.getState().sourceMetadata).toEqual({
			format: "sql",
			dialect: "mysql",
		});
	});

	it("lets explicit editor metadata changes stay out of Schema Payload", () => {
		const store = createDiagramSessionStore({
			source: "CREATE TABLE users (id int primary key);",
			parsedSchema: usersOnly,
			tablePositions: {},
			stickyNotes: [],
		});

		store.getState().setSourceMetadata({
			format: "sql",
			dialect: "mysql",
		});

		expect(store.getState().sourceMetadata).toEqual({
			format: "sql",
			dialect: "mysql",
		});
		expect(store.getState().toSchemaPayload()).toEqual({
			source: "CREATE TABLE users (id int primary key);",
			positions: {},
			notes: [],
			version: 3,
		});
	});

	it("prunes Table Positions for Tables removed from the new Parsed Schema", () => {
		const store = createDiagramSessionStore();

		store.getState().applyParseResult({
			kind: "success",
			parsedSchema: usersAndOrders,
			metadata: { format: "dbml" },
		});
		store.getState().commitTablePositions({
			users: { x: 10, y: 20 },
			orders: { x: 200, y: 30 },
		});

		store.getState().applyParseResult({
			kind: "success",
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
			kind: "success",
			parsedSchema: usersAndOrders,
			metadata: { format: "dbml" },
		});
		store.getState().commitTablePositions({ users: { x: 10, y: 20 } });

		store.getState().applyParseResult({
			kind: "failure",
			diagnostics: [{ message: "Unexpected token" }],
		});

		expect(store.getState().diagram.parsedSchema).toBe(usersAndOrders);
		expect(store.getState().diagram.tablePositions).toEqual({
			users: { x: 10, y: 20 },
			orders: expect.any(Object),
		});
		expect(store.getState().parseDiagnostics).toEqual([
			{ message: "Unexpected token" },
		]);
	});

	it("replaces older diagnostics on a later parse failure", () => {
		const store = createDiagramSessionStore();

		store.getState().applyParseResult({
			kind: "failure",
			diagnostics: [{ message: "first error" }],
		});
		store.getState().applyParseResult({
			kind: "failure",
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

		expect(store.getState().diagram.tablePositions).toEqual({
			people: expect.any(Object),
		});
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

	it("clears Parsed Schema and Table Positions on the empty parse result while preserving Source, Sticky Notes, and metadata", () => {
		const store = createDiagramSessionStore();

		store.getState().setSourceMetadata({ format: "sql", dialect: "mysql" });
		store.getState().applyParseResult({
			kind: "success",
			parsedSchema: usersAndOrders,
			metadata: { format: "sql", dialect: "mysql" },
		});
		store.getState().commitTablePositions({
			users: { x: 10, y: 20 },
			orders: { x: 100, y: 80 },
		});
		store.getState().addStickyNote({
			id: "note-1",
			color: "yellow",
			text: "remember this",
			x: 200,
			y: 200,
		});
		store.getState().setSchemaSource("");

		store.getState().applyParseResult({ kind: "empty" });

		expect(store.getState().diagram.parsedSchema).toEqual({
			tables: [],
			refs: [],
			errors: [],
		});
		expect(store.getState().diagram.tablePositions).toEqual({});
		expect(store.getState().diagram.source).toBe("");
		expect(store.getState().diagram.stickyNotes).toEqual([
			expect.objectContaining({ id: "note-1", text: "remember this" }),
		]);
		expect(store.getState().sourceMetadata).toEqual({
			format: "sql",
			dialect: "mysql",
		});
		expect(store.getState().parseDiagnostics).toEqual([]);
	});

	it("reports removed Table ids in lastParseTableDiff on the empty parse result", () => {
		const store = createDiagramSessionStore();

		store.getState().applyParseResult({
			kind: "success",
			parsedSchema: usersAndOrders,
			metadata: { format: "dbml" },
		});

		store.getState().applyParseResult({ kind: "empty" });

		expect(store.getState().lastParseTableDiff).toEqual({
			addedTableIds: [],
			removedTableIds: ["users", "orders"],
		});
	});

	it("clears prior Parse Diagnostics on the empty parse result", () => {
		const store = createDiagramSessionStore();

		store.getState().applyParseResult({
			kind: "failure",
			diagnostics: [{ message: "Unexpected token" }],
		});

		store.getState().applyParseResult({ kind: "empty" });

		expect(store.getState().parseDiagnostics).toEqual([]);
	});

	it("treats the empty parse result as a no-op when the Diagram is already empty", () => {
		const store = createDiagramSessionStore();
		const before = store.getState();

		store.getState().applyParseResult({ kind: "empty" });

		expect(store.getState()).toBe(before);
	});
});
