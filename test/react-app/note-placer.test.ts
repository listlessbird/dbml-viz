import { describe, expect, it } from "vitest";

import { placeStickyNotes } from "@/diagram-layout/note-placer";
import type {
	ParsedSchema,
	SharedStickyNote,
	StickyNoteColor,
	TableData,
} from "@/types";

const table = (id: string, name: string = id): TableData => ({
	id,
	name,
	columns: [],
	indexes: [],
});

const note = (
	id: string,
	text: string,
	overrides: Partial<SharedStickyNote> = {},
): SharedStickyNote => ({
	id,
	color: "yellow" as StickyNoteColor,
	text,
	...overrides,
});

const noteLayout = () => ({ width: 220, height: 160 });
const tableLayout = () => ({
	width: 220,
	height: 180,
	typeColumnWidth: 100,
});

const twoTables: ParsedSchema = {
	tables: [table("users"), table("orders")],
	refs: [],
	errors: [],
};

const rectsOverlap = (
	left: { x: number; y: number; w: number; h: number },
	right: { x: number; y: number; w: number; h: number },
) =>
	left.x < right.x + right.w &&
	left.x + left.w > right.x &&
	left.y < right.y + right.h &&
	left.y + left.h > right.y;

describe("Note Placer", () => {
	it("returns empty result when no notes are provided", () => {
		const result = placeStickyNotes({
			parsedSchema: twoTables,
			tablePositions: { users: { x: 0, y: 0 } },
			stickyNotes: [],
			getNoteLayout: noteLayout,
			getTableLayout: tableLayout,
		});

		expect(result.stickyNotes).toEqual([]);
		expect(result.placedNoteIds).toEqual([]);
	});

	it("places a single orphan note below the Tables in the isolated region", () => {
		const result = placeStickyNotes({
			parsedSchema: twoTables,
			tablePositions: {
				users: { x: 100, y: 100 },
				orders: { x: 400, y: 100 },
			},
			stickyNotes: [note("n1", "plain text without any tokens")],
			getNoteLayout: noteLayout,
			getTableLayout: tableLayout,
		});

		expect(result.placedNoteIds).toEqual(["n1"]);
		const placed = result.stickyNotes[0]!;
		expect(typeof placed.x).toBe("number");
		expect(typeof placed.y).toBe("number");
		expect(placed.y!).toBeGreaterThan(100 + 180);
	});

	it("anchors a note near the centre of its single referenced Table", () => {
		const result = placeStickyNotes({
			parsedSchema: twoTables,
			tablePositions: {
				users: { x: 100, y: 100 },
				orders: { x: 1200, y: 100 },
			},
			stickyNotes: [note("n1", "Notes about #users")],
			getNoteLayout: noteLayout,
			getTableLayout: tableLayout,
		});

		const placed = result.stickyNotes[0]!;
		const usersCentre = { x: 100 + 220 / 2, y: 100 + 180 / 2 };
		const ordersCentre = { x: 1200 + 220 / 2, y: 100 + 180 / 2 };
		const noteCentre = { x: placed.x! + 220 / 2, y: placed.y! + 160 / 2 };
		const dUsers = Math.hypot(
			noteCentre.x - usersCentre.x,
			noteCentre.y - usersCentre.y,
		);
		const dOrders = Math.hypot(
			noteCentre.x - ordersCentre.x,
			noteCentre.y - ordersCentre.y,
		);
		expect(dUsers).toBeLessThan(dOrders);
	});

	it("centroids a note that references two Tables between them", () => {
		const result = placeStickyNotes({
			parsedSchema: twoTables,
			tablePositions: {
				users: { x: 100, y: 100 },
				orders: { x: 1200, y: 100 },
			},
			stickyNotes: [note("n1", "Joins #users and #orders")],
			getNoteLayout: noteLayout,
			getTableLayout: tableLayout,
		});

		const placed = result.stickyNotes[0]!;
		const noteCentre = { x: placed.x! + 220 / 2, y: placed.y! + 160 / 2 };
		const usersCentre = { x: 100 + 220 / 2, y: 100 + 180 / 2 };
		const ordersCentre = { x: 1200 + 220 / 2, y: 100 + 180 / 2 };
		const expectedCentroid = {
			x: (usersCentre.x + ordersCentre.x) / 2,
			y: (usersCentre.y + ordersCentre.y) / 2,
		};
		// Centroid placement: the note's base position is the centroid; after spiral
		// fallback it may have moved, but it should still be far closer to the centroid
		// than to either Table's centre.
		const dCentroid = Math.hypot(
			noteCentre.x - expectedCentroid.x,
			noteCentre.y - expectedCentroid.y,
		);
		const dUsers = Math.hypot(
			noteCentre.x - usersCentre.x,
			noteCentre.y - usersCentre.y,
		);
		const dOrders = Math.hypot(
			noteCentre.x - ordersCentre.x,
			noteCentre.y - ordersCentre.y,
		);
		expect(dCentroid).toBeLessThan(dUsers);
		expect(dCentroid).toBeLessThan(dOrders);
	});

	it("falls back to the isolated region when a #table token does not resolve to a positioned Table", () => {
		const result = placeStickyNotes({
			parsedSchema: twoTables,
			tablePositions: { users: { x: 100, y: 100 } },
			stickyNotes: [note("n1", "Talks only about #orders")],
			getNoteLayout: noteLayout,
			getTableLayout: tableLayout,
		});

		const placed = result.stickyNotes[0]!;
		expect(typeof placed.x).toBe("number");
		expect(typeof placed.y).toBe("number");
		expect(placed.y!).toBeGreaterThan(100 + 180);
	});

	it("resolves anchored when at least one #table token has a position even if others do not", () => {
		const result = placeStickyNotes({
			parsedSchema: twoTables,
			tablePositions: { users: { x: 100, y: 100 } },
			stickyNotes: [note("n1", "About #users and #orders")],
			getNoteLayout: noteLayout,
			getTableLayout: tableLayout,
		});

		const placed = result.stickyNotes[0]!;
		const usersCentre = { x: 100 + 220 / 2, y: 100 + 180 / 2 };
		const noteCentre = { x: placed.x! + 220 / 2, y: placed.y! + 160 / 2 };
		// Anchored to users only - should be near it, not in the orphan grid far below.
		expect(Math.abs(noteCentre.y - usersCentre.y)).toBeLessThan(600);
	});

	it("does not overlap two notes that anchor on the same Table", () => {
		const result = placeStickyNotes({
			parsedSchema: twoTables,
			tablePositions: { users: { x: 100, y: 100 } },
			stickyNotes: [
				note("n1", "#users one"),
				note("n2", "#users two"),
				note("n3", "#users three"),
				note("n4", "#users four"),
			],
			getNoteLayout: noteLayout,
			getTableLayout: tableLayout,
		});

		const placed = result.stickyNotes.map((n) => ({
			x: n.x!,
			y: n.y!,
			w: 220,
			h: 160,
		}));
		for (let i = 0; i < placed.length; i += 1) {
			for (let j = i + 1; j < placed.length; j += 1) {
				expect(rectsOverlap(placed[i]!, placed[j]!)).toBe(false);
			}
		}
	});

	it("passes through pre-placed notes by reference and only places notes without coordinates when no subset is given", () => {
		const placedNote = note("n1", "About #users", { x: 700, y: 700 });
		const newNote = note("n2", "About #orders");
		const result = placeStickyNotes({
			parsedSchema: twoTables,
			tablePositions: {
				users: { x: 100, y: 100 },
				orders: { x: 1200, y: 100 },
			},
			stickyNotes: [placedNote, newNote],
			getNoteLayout: noteLayout,
			getTableLayout: tableLayout,
		});

		expect(result.stickyNotes[0]).toBe(placedNote);
		expect(result.placedNoteIds).toEqual(["n2"]);
		expect(result.stickyNotes[1]!.x).toBeDefined();
		expect(result.stickyNotes[1]).not.toBe(newNote);
	});

	it("re-places every note when noteIdsToPlace includes them all (full-graph mode)", () => {
		const a = note("n1", "About #users", { x: 700, y: 700 });
		const b = note("n2", "About #orders", { x: 9000, y: 9000 });
		const result = placeStickyNotes({
			parsedSchema: twoTables,
			tablePositions: {
				users: { x: 100, y: 100 },
				orders: { x: 1200, y: 100 },
			},
			stickyNotes: [a, b],
			noteIdsToPlace: ["n1", "n2"],
			getNoteLayout: noteLayout,
			getTableLayout: tableLayout,
		});

		expect([...result.placedNoteIds].sort()).toEqual(["n1", "n2"]);
		expect(result.stickyNotes[0]).not.toBe(a);
		expect(result.stickyNotes[1]).not.toBe(b);
		// The pre-existing far-away coordinates should be replaced with anchored ones.
		expect(result.stickyNotes[1]!.x).toBeLessThan(9000);
	});

	it("places only the subset of note ids requested and passes the rest through by reference", () => {
		const a = note("n1", "About #users");
		const b = note("n2", "About #orders");
		const result = placeStickyNotes({
			parsedSchema: twoTables,
			tablePositions: {
				users: { x: 100, y: 100 },
				orders: { x: 1200, y: 100 },
			},
			stickyNotes: [a, b],
			noteIdsToPlace: ["n2"],
			getNoteLayout: noteLayout,
			getTableLayout: tableLayout,
		});

		expect(result.stickyNotes[0]).toBe(a);
		expect(result.placedNoteIds).toEqual(["n2"]);
		expect(result.stickyNotes[1]!.x).toBeDefined();
	});

	it("produces identical output for identical input (determinism)", () => {
		const stickyNotes = [
			note("n1", "About #users"),
			note("n2", "About #orders"),
			note("n3", "no tokens here"),
		];
		const args = {
			parsedSchema: twoTables,
			tablePositions: {
				users: { x: 100, y: 100 },
				orders: { x: 1200, y: 100 },
			},
			stickyNotes,
			getNoteLayout: noteLayout,
			getTableLayout: tableLayout,
		};
		const a = placeStickyNotes(args);
		const b = placeStickyNotes(args);
		expect(a.stickyNotes.map((n) => ({ x: n.x, y: n.y }))).toEqual(
			b.stickyNotes.map((n) => ({ x: n.x, y: n.y })),
		);
		expect(a.placedNoteIds).toEqual(b.placedNoteIds);
	});

	it("resolves #table tokens by Table name even when the id differs", () => {
		const schema: ParsedSchema = {
			tables: [{ id: "tbl_users", name: "users", columns: [], indexes: [] }],
			refs: [],
			errors: [],
		};
		const result = placeStickyNotes({
			parsedSchema: schema,
			tablePositions: { tbl_users: { x: 500, y: 500 } },
			stickyNotes: [note("n1", "About #users")],
			getNoteLayout: noteLayout,
			getTableLayout: tableLayout,
		});

		const placed = result.stickyNotes[0]!;
		const usersCentre = { x: 500 + 220 / 2, y: 500 + 180 / 2 };
		const noteCentre = { x: placed.x! + 220 / 2, y: placed.y! + 160 / 2 };
		// Anchored, so y should be near the table centre, not pushed below as orphan.
		expect(Math.abs(noteCentre.y - usersCentre.y)).toBeLessThan(500);
	});

	it("avoids overlapping a manually positioned note inside the orphan grid zone", () => {
		// Manually placed orphan blocking the natural grid start.
		const manualOrphan = note("manual", "no tokens", { x: 100, y: 900 });
		const newOrphan = note("new", "also no tokens");
		const result = placeStickyNotes({
			parsedSchema: twoTables,
			tablePositions: {
				users: { x: 100, y: 100 },
				orders: { x: 400, y: 100 },
			},
			stickyNotes: [manualOrphan, newOrphan],
			getNoteLayout: noteLayout,
			getTableLayout: tableLayout,
		});

		expect(result.stickyNotes[0]).toBe(manualOrphan);
		const placedNew = result.stickyNotes[1]!;
		const newRect = {
			x: placedNew.x!,
			y: placedNew.y!,
			w: 220,
			h: 160,
		};
		const manualRect = { x: 100, y: 900, w: 220, h: 160 };
		expect(rectsOverlap(newRect, manualRect)).toBe(false);
	});

	it("does not overlap notes with already-positioned Tables", () => {
		const result = placeStickyNotes({
			parsedSchema: twoTables,
			tablePositions: {
				users: { x: 100, y: 100 },
				orders: { x: 400, y: 100 },
			},
			stickyNotes: [note("n1", "About #users"), note("n2", "no tokens")],
			getNoteLayout: noteLayout,
			getTableLayout: tableLayout,
		});

		const tables = [
			{ x: 100, y: 100, w: 220, h: 180 },
			{ x: 400, y: 100, w: 220, h: 180 },
		];
		for (const placed of result.stickyNotes) {
			const noteRect = { x: placed.x!, y: placed.y!, w: 220, h: 160 };
			for (const tableRect of tables) {
				expect(rectsOverlap(noteRect, tableRect)).toBe(false);
			}
		}
	});
});
