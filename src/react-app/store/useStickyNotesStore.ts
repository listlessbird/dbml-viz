import { applyNodeChanges, type NodeChange, type XYPosition } from "@xyflow/react";
import { create } from "zustand";

import {
	STICKY_NOTE_COLORS,
	type SharedStickyNote,
	type StickyNoteColor,
} from "@/types";

export interface StickyNoteRecord {
	readonly id: string;
	readonly position: XYPosition;
	readonly color: StickyNoteColor;
	readonly selected?: boolean;
	readonly width: number;
	readonly height: number;
}

const DEFAULT_SIZE = { width: 220, height: 180 } as const;

interface StickyNotesState {
	readonly notes: readonly StickyNoteRecord[];
	readonly notesById: Readonly<Record<string, StickyNoteRecord>>;
	readonly texts: Readonly<Record<string, string>>;
	readonly addNote: (position: XYPosition) => string;
	readonly updateText: (id: string, text: string) => void;
	readonly updateColor: (id: string, color: StickyNoteColor) => void;
	readonly deleteNote: (id: string) => void;
	readonly applyChanges: (changes: NodeChange[]) => void;
	readonly hydrate: (shared: readonly SharedStickyNote[]) => void;
	readonly clear: () => void;
}

const indexById = (
	notes: readonly StickyNoteRecord[],
): Record<string, StickyNoteRecord> => {
	const index: Record<string, StickyNoteRecord> = {};
	for (const note of notes) {
		index[note.id] = note;
	}
	return index;
};

const pickNextColor = (existing: readonly StickyNoteRecord[]): StickyNoteColor => {
	const last = existing[existing.length - 1]?.color;
	const lastIndex = last ? STICKY_NOTE_COLORS.indexOf(last) : -1;
	return STICKY_NOTE_COLORS[(lastIndex + 1) % STICKY_NOTE_COLORS.length];
};

const omitKey = <T,>(record: Readonly<Record<string, T>>, key: string) => {
	if (!(key in record)) return record;
	const next = { ...record };
	delete next[key];
	return next;
};

export const useStickyNotesStore = create<StickyNotesState>((set) => ({
	notes: [],
	notesById: {},
	texts: {},
	addNote: (position) => {
		const id = `sticky-${crypto.randomUUID()}`;
		set((state) => {
			const nextNote: StickyNoteRecord = {
				id,
				position: {
					x: position.x - DEFAULT_SIZE.width / 2,
					y: position.y - DEFAULT_SIZE.height / 2,
				},
				color: pickNextColor(state.notes),
				width: DEFAULT_SIZE.width,
				height: DEFAULT_SIZE.height,
			};
			return {
				notes: [...state.notes, nextNote],
				notesById: { ...state.notesById, [id]: nextNote },
				texts: { ...state.texts, [id]: "" },
			};
		});
		return id;
	},
	updateText: (id, text) => {
		set((state) => ({ texts: { ...state.texts, [id]: text } }));
	},
	updateColor: (id, color) => {
		set((state) => {
			const existing = state.notesById[id];
			if (!existing || existing.color === color) return state;
			const nextNote = { ...existing, color };
			return {
				notes: state.notes.map((note) => (note.id === id ? nextNote : note)),
				notesById: { ...state.notesById, [id]: nextNote },
			};
		});
	},
	deleteNote: (id) => {
		set((state) => {
			if (!(id in state.notesById)) return state;
			return {
				notes: state.notes.filter((note) => note.id !== id),
				notesById: omitKey(state.notesById, id) as Record<string, StickyNoteRecord>,
				texts: omitKey(state.texts, id),
			};
		});
	},
	applyChanges: (changes) => {
		if (changes.length === 0) return;

		set((state) => {
			const asNodes = state.notes.map((note) => ({
				id: note.id,
				type: "sticky",
				position: note.position,
				data: {},
				selected: note.selected ?? false,
				width: note.width,
				height: note.height,
			}));
			const updated = applyNodeChanges(changes, asNodes);
			const updatedById = new Map(updated.map((node) => [node.id, node] as const));

			let nextTexts = state.texts;
			for (const note of state.notes) {
				if (!updatedById.has(note.id)) {
					nextTexts = omitKey(nextTexts, note.id);
				}
			}

			const nextNotes = state.notes
				.filter((note) => updatedById.has(note.id))
				.map((note) => {
					const next = updatedById.get(note.id);
					if (!next) return note;
					const nextSelected = next.selected ?? false;
					const nextPosition = next.position ?? note.position;
					const nextWidth = next.width ?? note.width;
					const nextHeight = next.height ?? note.height;

					if (
						nextSelected === (note.selected ?? false) &&
						nextPosition === note.position &&
						nextWidth === note.width &&
						nextHeight === note.height
					) {
						return note;
					}

					return {
						...note,
						position: nextPosition,
						selected: nextSelected,
						width: nextWidth,
						height: nextHeight,
					};
				});

			if (nextNotes === state.notes && nextTexts === state.texts) {
				return state;
			}

			const notesChanged =
				nextNotes.length !== state.notes.length ||
				nextNotes.some((note, index) => note !== state.notes[index]);

			return {
				notes: notesChanged ? nextNotes : state.notes,
				notesById: notesChanged ? indexById(nextNotes) : state.notesById,
				texts: nextTexts,
			};
		});
	},
	hydrate: (shared) => {
		const notes: StickyNoteRecord[] = shared.map((note) => ({
			id: note.id,
			position: { x: note.x, y: note.y },
			width: note.width,
			height: note.height,
			color: note.color,
		}));
		const texts: Record<string, string> = {};
		for (const note of shared) {
			texts[note.id] = note.text;
		}

		set({ notes, notesById: indexById(notes), texts });
	},
	clear: () => {
		set({ notes: [], notesById: {}, texts: {} });
	},
}));

export const getSharedStickyNotes = (): SharedStickyNote[] => {
	const { notes, texts } = useStickyNotesStore.getState();
	return notes.map((note) => ({
		id: note.id,
		x: note.position.x,
		y: note.position.y,
		width: note.width,
		height: note.height,
		color: note.color,
		text: texts[note.id] ?? "",
	}));
};
