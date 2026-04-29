import { describe, expect, it } from "vitest";

import { createDiagramSessionStore } from "@/diagram-session/diagram-session-store";
import type { SharedStickyNote } from "@/types";

const note = (id: string, text = "Review #users"): SharedStickyNote => ({
	id,
	x: 10,
	y: 20,
	width: 220,
	height: 180,
	color: "yellow",
	text,
});

describe("Diagram Session Sticky Notes", () => {
	it("owns add, update, delete, and replace operations for Sticky Notes", () => {
		const store = createDiagramSessionStore();

		store.getState().addStickyNote(note("sticky-1"));
		store.getState().updateStickyNote("sticky-1", {
			x: 40,
			y: 80,
			color: "blue",
			text: "Updated",
		});

		expect(store.getState().toSchemaPayload().notes).toEqual([
			{
				id: "sticky-1",
				x: 40,
				y: 80,
				width: 220,
				height: 180,
				color: "blue",
				text: "Updated",
			},
		]);

		store.getState().deleteStickyNote("sticky-1");
		expect(store.getState().toSchemaPayload().notes).toEqual([]);

		store.getState().replaceStickyNotes([note("sticky-2")]);
		expect(store.getState().toSchemaPayload().notes).toEqual([note("sticky-2")]);

		store.getState().replaceStickyNotes([note("sticky-3")]);
		expect(store.getState().toSchemaPayload().notes).toEqual([note("sticky-3")]);
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

		expect(store.getState().diagram.stickyNotes).toEqual([note("new-note")]);
		expect(store.getState().diagram.stickyNotes).not.toContainEqual(
			note("old-note"),
		);
	});
});
