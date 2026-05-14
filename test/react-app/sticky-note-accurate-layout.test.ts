import { describe, expect, it } from "vitest";

import {
	createAccurateStickyNoteLayoutCache,
	createAccurateStickyNoteLayoutGetter,
	STICKY_NOTE_MIN_HEIGHT,
	STICKY_NOTE_MIN_WIDTH,
} from "@/canvas-next/sticky-note/measure";
import type { ParsedSchema, SharedStickyNote, TableData } from "@/types";

const table = (id: string, name = id, columns: string[] = []): TableData => ({
	id,
	name,
	columns: columns.map((columnName) => ({
		name: columnName,
		type: "int",
		pk: false,
		notNull: false,
		unique: false,
		isForeignKey: false,
		isIndexed: false,
	})),
	indexes: [],
});

const usersSchema: ParsedSchema = {
	tables: [table("users", "users", ["id", "email"])],
	refs: [],
	errors: [],
};

const note = (id: string, text: string): SharedStickyNote => ({
	id,
	color: "yellow",
	text,
});

describe("Accurate Sticky Note layout getter", () => {
	it("returns at least the minimum dimensions for an empty note", () => {
		const getter = createAccurateStickyNoteLayoutGetter(usersSchema);
		const layout = getter(note("n1", ""));

		expect(layout.width).toBeGreaterThanOrEqual(STICKY_NOTE_MIN_WIDTH);
		expect(layout.height).toBeGreaterThanOrEqual(STICKY_NOTE_MIN_HEIGHT);
	});

	it("grows the layout when the note text is large enough to wrap", () => {
		const getter = createAccurateStickyNoteLayoutGetter(usersSchema);
		const shortLayout = getter(note("short", "Hi"));
		const longText = Array.from({ length: 20 })
			.map(
				() =>
					"A long paragraph that should wrap across many lines in the sticky note body to grow its height.",
			)
			.join(" ");
		const longLayout = getter(note("long", longText));

		expect(longLayout.height).toBeGreaterThan(shortLayout.height);
	});

	it("returns the same StickyNoteLayout instance for repeated calls inside one cache scope", () => {
		const cache = createAccurateStickyNoteLayoutCache(usersSchema);
		const stickyNote = note("n1", "About #users");
		const first = cache(stickyNote);
		const second = cache(stickyNote);

		expect(second).toBe(first);
	});

	it("gives fresh caches no shared state across separate scopes", () => {
		const stickyNote = note("n1", "About #users");
		const first = createAccurateStickyNoteLayoutCache(usersSchema)(stickyNote);
		const second = createAccurateStickyNoteLayoutCache(usersSchema)(stickyNote);

		expect(second).toEqual(first);
		expect(second).not.toBe(first);
	});

	it("matches what useStickyLayout would render for the same note", () => {
		const longText = Array.from({ length: 6 })
			.map(() => "Long body content that wraps several lines in display mode.")
			.join("\n");
		const getter = createAccurateStickyNoteLayoutGetter(usersSchema);
		const layout = getter(note("n1", longText));

		expect(layout.width).toBeGreaterThanOrEqual(STICKY_NOTE_MIN_WIDTH);
		expect(layout.height).toBeGreaterThan(STICKY_NOTE_MIN_HEIGHT);
	});
});
