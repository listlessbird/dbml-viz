import { createStore, type StoreApi } from "zustand/vanilla";

import type {
	Diagram,
	DiagramSession,
} from "@/diagram-session/diagram-session-context";
import type { ParseResult } from "@/schema-source/parse-schema-source";
import type {
	DiagramPositions,
	ParseDiagnostic,
	ParsedSchema,
	SchemaSourceMetadata,
	SharedStickyNote,
} from "@/types";
import { placeMissingTablePositions } from "@/diagram-layout/fallback-placement";

export const emptyParsedSchema: ParsedSchema = Object.freeze({
	tables: [],
	refs: [],
	errors: [],
});

export const emptyDiagram: Diagram = Object.freeze({
	source: "",
	parsedSchema: emptyParsedSchema,
	tablePositions: {},
	stickyNotes: [],
});

export interface DiagramSessionState extends DiagramSession {
	readonly sourceMetadata: SchemaSourceMetadata;
	readonly lastParseTableDiff: TableDiff;
	readonly hydrateDiagram: (
		diagram: Diagram,
		metadata?: SchemaSourceMetadata,
	) => void;
	readonly setSchemaSource: (source: string) => void;
	readonly setSourceMetadata: (metadata: SchemaSourceMetadata) => void;
	readonly replaceParsedSchema: (parsedSchema: ParsedSchema) => void;
	readonly applyParseResult: (result: ParseResult) => void;
	readonly addStickyNote: (note: SharedStickyNote) => void;
	readonly updateStickyNote: (
		id: string,
		patch: Partial<Omit<SharedStickyNote, "id">>,
	) => void;
	readonly deleteStickyNote: (id: string) => void;
	readonly replaceStickyNotes: (notes: readonly SharedStickyNote[]) => void;
}

export type DiagramSessionStore = StoreApi<DiagramSessionState>;

interface TableDiff {
	readonly addedTableIds: readonly string[];
	readonly removedTableIds: readonly string[];
}

const prunePositionsForTables = (
	positions: DiagramPositions,
	parsedSchema: ParsedSchema,
): DiagramPositions => {
	const knownTableIds = new Set(parsedSchema.tables.map((table) => table.id));
	const next: DiagramPositions = {};
	for (const [tableId, position] of Object.entries(positions)) {
		if (knownTableIds.has(tableId)) {
			next[tableId] = position;
		}
	}
	return next;
};

const commitPositionsForTables = (
	positions: Readonly<DiagramPositions>,
	parsedSchema: ParsedSchema,
): DiagramPositions => {
	const knownTableIds = new Set(parsedSchema.tables.map((table) => table.id));
	const next: DiagramPositions = {};
	for (const [tableId, position] of Object.entries(positions)) {
		if (!knownTableIds.has(tableId)) continue;
		if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) continue;
		next[tableId] = { x: position.x, y: position.y };
	}
	return next;
};

const noDiagnostics: readonly ParseDiagnostic[] = Object.freeze([]);
const emptyTableDiff: TableDiff = Object.freeze({
	addedTableIds: [],
	removedTableIds: [],
});
const defaultSourceMetadata: SchemaSourceMetadata = Object.freeze({ format: "dbml" });

const diffTables = (
	previousSchema: ParsedSchema,
	nextSchema: ParsedSchema,
): TableDiff => {
	const previousIds = new Set(previousSchema.tables.map((table) => table.id));
	const nextIds = new Set(nextSchema.tables.map((table) => table.id));
	return {
		addedTableIds: nextSchema.tables
			.filter((table) => !previousIds.has(table.id))
			.map((table) => table.id),
		removedTableIds: previousSchema.tables
			.filter((table) => !nextIds.has(table.id))
			.map((table) => table.id),
	};
};

const seedMissingTablePositions = (
	parsedSchema: ParsedSchema,
	tablePositions: DiagramPositions,
): DiagramPositions =>
	placeMissingTablePositions(parsedSchema, tablePositions).tablePositions;

const hydrateTablePositions = (diagram: Diagram): DiagramPositions => {
	if (diagram.parsedSchema.tables.length === 0) {
		return diagram.tablePositions;
	}
	return seedMissingTablePositions(
		diagram.parsedSchema,
		prunePositionsForTables(diagram.tablePositions, diagram.parsedSchema),
	);
};

export function createDiagramSessionStore(
	initialDiagram: Diagram = emptyDiagram,
	initialMetadata: SchemaSourceMetadata = defaultSourceMetadata,
): DiagramSessionStore {
	return createStore<DiagramSessionState>()((set, get) => ({
		diagram: initialDiagram,
		sourceMetadata: initialMetadata,
		parseDiagnostics: noDiagnostics,
		lastParseTableDiff: emptyTableDiff,
		hydrateDiagram: (diagram, metadata = defaultSourceMetadata) => {
			set({
				diagram: {
					...diagram,
					tablePositions: hydrateTablePositions(diagram),
				},
				sourceMetadata: metadata,
				parseDiagnostics: noDiagnostics,
				lastParseTableDiff: emptyTableDiff,
			});
		},
		setSchemaSource: (source) => {
			set((state) => ({
				diagram: {
					...state.diagram,
					source,
				},
			}));
		},
		setSourceMetadata: (sourceMetadata) => {
			set({ sourceMetadata });
		},
		replaceParsedSchema: (parsedSchema) => {
			set((state) => ({
				diagram: {
					...state.diagram,
					parsedSchema,
					tablePositions: seedMissingTablePositions(
						parsedSchema,
						prunePositionsForTables(state.diagram.tablePositions, parsedSchema),
					),
				},
				lastParseTableDiff: diffTables(state.diagram.parsedSchema, parsedSchema),
			}));
		},
		applyParseResult: (result) => {
			if (result.ok) {
				set((state) => {
					const tablePositions = prunePositionsForTables(
						state.diagram.tablePositions,
						result.parsedSchema,
					);
					return {
						diagram: {
							...state.diagram,
							parsedSchema: result.parsedSchema,
							tablePositions: seedMissingTablePositions(
								result.parsedSchema,
								tablePositions,
							),
						},
						sourceMetadata: result.metadata,
						parseDiagnostics: noDiagnostics,
						lastParseTableDiff: diffTables(
							state.diagram.parsedSchema,
							result.parsedSchema,
						),
					};
				});
				return;
			}
			set({ parseDiagnostics: result.diagnostics });
		},
		commitTablePositions: (positions) => {
			set((state) => {
				const committed = commitPositionsForTables(
					positions,
					state.diagram.parsedSchema,
				);
				if (Object.keys(committed).length === 0) {
					return state;
				}
				return {
					diagram: {
						...state.diagram,
						tablePositions: {
							...state.diagram.tablePositions,
							...committed,
						},
					},
				};
			});
		},
		addStickyNote: (note) => {
			set((state) => {
				if (
					state.diagram.stickyNotes.some((existing) => existing.id === note.id)
				) {
					return state;
				}
				return {
					diagram: {
						...state.diagram,
						stickyNotes: [...state.diagram.stickyNotes, note],
					},
				};
			});
		},
		updateStickyNote: (id, patch) => {
			set((state) => {
				let changed = false;
				const stickyNotes = state.diagram.stickyNotes.map((note) => {
					if (note.id !== id) return note;
					const next = { ...note, ...patch };
					changed = Object.keys(patch).some(
						(key) =>
							next[key as keyof SharedStickyNote] !==
							note[key as keyof SharedStickyNote],
					);
					return next;
				});
				if (!changed) return state;
				return {
					diagram: {
						...state.diagram,
						stickyNotes,
					},
				};
			});
		},
		deleteStickyNote: (id) => {
			set((state) => {
				const stickyNotes = state.diagram.stickyNotes.filter(
					(note) => note.id !== id,
				);
				if (stickyNotes.length === state.diagram.stickyNotes.length) {
					return state;
				}
				return {
					diagram: {
						...state.diagram,
						stickyNotes,
					},
				};
			});
		},
		replaceStickyNotes: (stickyNotes) => {
			set((state) => ({
				diagram: {
					...state.diagram,
					stickyNotes,
				},
			}));
		},
		toSchemaPayload: () => {
			const diagram = get().diagram;
			return {
				source: diagram.source,
				positions: diagram.tablePositions,
				notes: diagram.stickyNotes,
				version: 3,
			};
		},
	}));
}
