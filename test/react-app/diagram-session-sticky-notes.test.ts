import { describe, expect, it } from "vitest";

import { createDiagramSessionStore } from "@/diagram-session/diagram-session-store";
import type { ParsedSchema, SharedStickyNote, TableData } from "@/types";

const note = (id: string, text = "Review #users"): SharedStickyNote => ({
	id,
	color: "yellow",
	text,
});

const table = (id: string, name = id): TableData => ({
	id,
	name,
	columns: [],
	indexes: [],
});

const usersSchema: ParsedSchema = {
	tables: [table("users")],
	refs: [],
	errors: [],
};

describe("Diagram Session Sticky Notes", () => {
	it("owns add, update, delete, and replace operations for Sticky Notes", () => {
		const store = createDiagramSessionStore();

		store.getState().addStickyNote(note("sticky-1"));
		store.getState().updateStickyNote("sticky-1", {
			color: "blue",
			text: "Updated",
		});

		expect(store.getState().toSchemaPayload().notes).toEqual([
			{
				id: "sticky-1",
				color: "blue",
				text: "Updated",
			},
		]);

		store.getState().deleteStickyNote("sticky-1");
		expect(store.getState().toSchemaPayload().notes).toEqual([]);

		store.getState().replaceStickyNotes([note("sticky-2")]);
		expect(store.getState().toSchemaPayload().notes).toEqual([
			expect.objectContaining({ id: "sticky-2", color: "yellow" }),
		]);

		store.getState().replaceStickyNotes([note("sticky-3")]);
		expect(store.getState().toSchemaPayload().notes).toEqual([
			expect.objectContaining({ id: "sticky-3", color: "yellow" }),
		]);
	});

	it("hydrates a Diagram by replacing old Sticky Notes", () => {
		const store = createDiagramSessionStore({
			source: "Table users {}",
			parsedSchema: { tables: [], refs: [], errors: [] },
			tablePositions: {},
			stickyNotes: [note("old-note")],
		});

		store.getState().hydrateDiagram({
			source: "Table orders {}",
			parsedSchema: { tables: [], refs: [], errors: [] },
			tablePositions: {},
			stickyNotes: [note("new-note")],
		});

		const result = store.getState().diagram.stickyNotes;
		expect(result).toHaveLength(1);
		expect(result[0]!.id).toBe("new-note");
		expect(result.some((n) => n.id === "old-note")).toBe(false);
	});

	it("seeds positions for unplaced notes on replaceStickyNotes and leaves placed notes by reference", () => {
		const store = createDiagramSessionStore({
			source: "",
			parsedSchema: usersSchema,
			tablePositions: { users: { x: 200, y: 200 } },
			stickyNotes: [],
		});
		const placed: SharedStickyNote = {
			id: "placed",
			color: "yellow",
			text: "manual #users",
			x: 1500,
			y: 1500,
		};
		const unplaced: SharedStickyNote = {
			id: "unplaced",
			color: "blue",
			text: "fresh #users",
		};

		store.getState().replaceStickyNotes([placed, unplaced]);

		const result = store.getState().diagram.stickyNotes;
		expect(result[0]).toBe(placed);
		const seeded = result[1]!;
		expect(typeof seeded.x).toBe("number");
		expect(typeof seeded.y).toBe("number");
		expect(seeded.id).toBe("unplaced");
	});

	it("short-circuits replaceStickyNotes when every incoming note already has coordinates", () => {
		const store = createDiagramSessionStore({
			source: "",
			parsedSchema: usersSchema,
			tablePositions: { users: { x: 200, y: 200 } },
			stickyNotes: [],
		});
		const a: SharedStickyNote = {
			id: "a",
			color: "yellow",
			text: "manual",
			x: 50,
			y: 50,
		};
		const b: SharedStickyNote = {
			id: "b",
			color: "blue",
			text: "manual",
			x: 800,
			y: 800,
		};

		store.getState().replaceStickyNotes([a, b]);
		const result = store.getState().diagram.stickyNotes;
		expect(result[0]).toBe(a);
		expect(result[1]).toBe(b);
	});

	it("hydrateDiagram seeds positions for every unplaced Sticky Note in the incoming Diagram", () => {
		const store = createDiagramSessionStore();

		store.getState().hydrateDiagram({
			source: "",
			parsedSchema: usersSchema,
			tablePositions: { users: { x: 100, y: 100 } },
			stickyNotes: [
				{ id: "n1", color: "yellow", text: "About #users" },
				{ id: "n2", color: "blue", text: "Plain orphan" },
			],
		});

		const result = store.getState().diagram.stickyNotes;
		expect(result).toHaveLength(2);
		for (const stickyNote of result) {
			expect(typeof stickyNote.x).toBe("number");
			expect(typeof stickyNote.y).toBe("number");
		}
	});

	it("preserves manual Sticky Note coordinates across replaceStickyNotes incremental edits", () => {
		const placed: SharedStickyNote = {
			id: "placed",
			color: "yellow",
			text: "kept",
			x: 421,
			y: 422,
		};
		const store = createDiagramSessionStore({
			source: "",
			parsedSchema: usersSchema,
			tablePositions: { users: { x: 0, y: 0 } },
			stickyNotes: [placed],
		});

		const edited: SharedStickyNote = { ...placed, text: "edited" };
		store.getState().replaceStickyNotes([edited]);

		const result = store.getState().diagram.stickyNotes[0]!;
		expect(result.x).toBe(421);
		expect(result.y).toBe(422);
		expect(result.text).toBe("edited");
	});
});
