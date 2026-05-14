import type {
	DiagramPositions,
	ParsedSchema,
	SharedStickyNote,
	StickyNoteLayout,
	TableData,
	TableNodeLayout,
} from "@/types";

const DEFAULT_TABLE_SIZE: TableNodeLayout = Object.freeze({
	width: 220,
	height: 180,
	typeColumnWidth: 100,
});
const DEFAULT_NOTE_SIZE: StickyNoteLayout = Object.freeze({
	width: 220,
	height: 160,
});
const START_X = 100;
const ORPHAN_COLUMNS = 8;
const ORPHAN_GAP_X = 80;
const ORPHAN_GAP_Y = 80;
const MAX_SPIRAL_ITERATIONS = 1000;

const LINK_PATTERN = /#([A-Za-z_][\w]*)(?:\.[A-Za-z_][\w]*)?/g;

export interface NotePlacementRequest {
	readonly parsedSchema: ParsedSchema;
	readonly tablePositions: DiagramPositions;
	readonly stickyNotes: readonly SharedStickyNote[];
	readonly noteIdsToPlace?: readonly string[];
	readonly getNoteLayout?: (note: SharedStickyNote) => StickyNoteLayout;
	readonly getTableLayout?: (table: TableData) => TableNodeLayout;
}

export interface NotePlacementResult {
	readonly stickyNotes: readonly SharedStickyNote[];
	readonly placedNoteIds: readonly string[];
}

type Rect = {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
};

const rectsOverlap = (left: Rect, right: Rect): boolean =>
	left.x < right.x + right.width &&
	left.x + left.width > right.x &&
	left.y < right.y + right.height &&
	left.y + left.height > right.y;

const hasFiniteCoordinates = (
	note: SharedStickyNote,
): note is SharedStickyNote & { readonly x: number; readonly y: number } =>
	typeof note.x === "number" &&
	typeof note.y === "number" &&
	Number.isFinite(note.x) &&
	Number.isFinite(note.y);

const extractTableTokens = (text: string): readonly string[] => {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const match of text.matchAll(LINK_PATTERN)) {
		const tableName = match[1]!;
		if (seen.has(tableName)) continue;
		seen.add(tableName);
		out.push(tableName);
	}
	return out;
};

export const placeStickyNotes = ({
	parsedSchema,
	tablePositions,
	stickyNotes,
	noteIdsToPlace,
	getNoteLayout,
	getTableLayout,
}: NotePlacementRequest): NotePlacementResult => {
	if (stickyNotes.length === 0) {
		return { stickyNotes: [], placedNoteIds: [] };
	}

	const resolveNoteLayout = getNoteLayout ?? (() => DEFAULT_NOTE_SIZE);
	const resolveTableLayout = getTableLayout ?? (() => DEFAULT_TABLE_SIZE);

	const tableById = new Map<string, TableData>();
	const tableIdByName = new Map<string, string>();
	for (const table of parsedSchema.tables) {
		tableById.set(table.id, table);
		if (!tableIdByName.has(table.name)) {
			tableIdByName.set(table.name, table.id);
		}
	}

	const resolveTableId = (token: string): string | undefined => {
		if (tableById.has(token)) return token;
		return tableIdByName.get(token);
	};

	const explicitSubset = noteIdsToPlace !== undefined;
	const idsToPlace = new Set<string>(
		explicitSubset
			? noteIdsToPlace
			: stickyNotes
					.filter((note) => !hasFiniteCoordinates(note))
					.map((note) => note.id),
	);

	const occupied: Rect[] = [];
	for (const table of parsedSchema.tables) {
		const position = tablePositions[table.id];
		if (!position) continue;
		const layout = resolveTableLayout(table);
		occupied.push({
			x: position.x,
			y: position.y,
			width: layout.width,
			height: layout.height,
		});
	}
	for (const note of stickyNotes) {
		if (idsToPlace.has(note.id)) continue;
		if (!hasFiniteCoordinates(note)) continue;
		const layout = resolveNoteLayout(note);
		occupied.push({
			x: note.x,
			y: note.y,
			width: layout.width,
			height: layout.height,
		});
	}

	const findNonOverlapping = (
		base: { readonly x: number; readonly y: number },
		layout: StickyNoteLayout,
	): { readonly x: number; readonly y: number } => {
		const step = Math.max(layout.width, layout.height) / 2;
		let angle = 0;
		let radius = 0;
		for (let iteration = 0; iteration < MAX_SPIRAL_ITERATIONS; iteration += 1) {
			const candidate = {
				x: base.x + radius * Math.cos(angle),
				y: base.y + radius * Math.sin(angle),
			};
			const candidateRect: Rect = {
				x: candidate.x,
				y: candidate.y,
				width: layout.width,
				height: layout.height,
			};
			let collides = false;
			for (const rect of occupied) {
				if (rectsOverlap(candidateRect, rect)) {
					collides = true;
					break;
				}
			}
			if (!collides) return candidate;

			angle += Math.PI / 4;
			if (angle >= Math.PI * 2) {
				angle = 0;
				radius += step;
			}
		}
		return {
			x: base.x + radius * Math.cos(angle),
			y: base.y + radius * Math.sin(angle),
		};
	};

	interface AnchoredItem {
		readonly note: SharedStickyNote;
		readonly anchoredTableIds: readonly string[];
	}

	const anchored: AnchoredItem[] = [];
	const orphans: SharedStickyNote[] = [];

	for (const note of stickyNotes) {
		if (!idsToPlace.has(note.id)) continue;
		const tokens = extractTableTokens(note.text);
		const anchoredTableIds = tokens
			.map(resolveTableId)
			.filter((tableId): tableId is string => tableId !== undefined)
			.filter((tableId) => tablePositions[tableId] !== undefined);
		if (anchoredTableIds.length > 0) {
			anchored.push({ note, anchoredTableIds });
		} else {
			orphans.push(note);
		}
	}

	const placedById = new Map<string, { readonly x: number; readonly y: number }>();

	for (const item of anchored) {
		let centroidX = 0;
		let centroidY = 0;
		for (const tableId of item.anchoredTableIds) {
			const table = tableById.get(tableId)!;
			const layout = resolveTableLayout(table);
			const position = tablePositions[tableId]!;
			centroidX += position.x + layout.width / 2;
			centroidY += position.y + layout.height / 2;
		}
		centroidX /= item.anchoredTableIds.length;
		centroidY /= item.anchoredTableIds.length;

		const noteLayout = resolveNoteLayout(item.note);
		const base = {
			x: centroidX - noteLayout.width / 2,
			y: centroidY - noteLayout.height / 2,
		};
		const position = findNonOverlapping(base, noteLayout);
		placedById.set(item.note.id, position);
		occupied.push({
			x: position.x,
			y: position.y,
			width: noteLayout.width,
			height: noteLayout.height,
		});
	}

	let orphanBaseY = 0;
	let hasOccupied = false;
	for (const rect of occupied) {
		const bottom = rect.y + rect.height;
		if (!hasOccupied || bottom > orphanBaseY) {
			orphanBaseY = bottom;
			hasOccupied = true;
		}
	}
	const orphanStartY = hasOccupied ? orphanBaseY + ORPHAN_GAP_Y * 2 : START_X;

	for (let index = 0; index < orphans.length; index += 1) {
		const note = orphans[index]!;
		const noteLayout = resolveNoteLayout(note);
		const column = index % ORPHAN_COLUMNS;
		const row = Math.floor(index / ORPHAN_COLUMNS);
		const base = {
			x: START_X + column * (noteLayout.width + ORPHAN_GAP_X),
			y: orphanStartY + row * (noteLayout.height + ORPHAN_GAP_Y),
		};
		const position = findNonOverlapping(base, noteLayout);
		placedById.set(note.id, position);
		occupied.push({
			x: position.x,
			y: position.y,
			width: noteLayout.width,
			height: noteLayout.height,
		});
	}

	const placedNoteIds: string[] = [];
	const nextStickyNotes: SharedStickyNote[] = stickyNotes.map((note) => {
		const position = placedById.get(note.id);
		if (!position) return note;
		placedNoteIds.push(note.id);
		return { ...note, x: position.x, y: position.y };
	});

	return {
		stickyNotes: nextStickyNotes,
		placedNoteIds,
	};
};
