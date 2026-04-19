import { STICKY_NOTE_COLORS, type SchemaPayload, type SharePosition, type SharedStickyNote, type StickyNoteColor } from "@/types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
	typeof value === "number" && Number.isFinite(value);

const isSharePosition = (value: unknown): value is SharePosition =>
	isRecord(value) && isFiniteNumber(value.x) && isFiniteNumber(value.y);

const isPositionRecord = (
	value: unknown,
): value is Record<string, SharePosition> => {
	if (!isRecord(value)) {
		return false;
	}

	return Object.values(value).every(isSharePosition);
};

const isStickyNoteColor = (value: unknown): value is StickyNoteColor =>
	typeof value === "string" &&
	(STICKY_NOTE_COLORS as readonly string[]).includes(value);

const isSharedStickyNote = (value: unknown): value is SharedStickyNote =>
	isRecord(value) &&
	typeof value.id === "string" &&
	isFiniteNumber(value.x) &&
	isFiniteNumber(value.y) &&
	isFiniteNumber(value.width) &&
	isFiniteNumber(value.height) &&
	isStickyNoteColor(value.color) &&
	typeof value.text === "string";

const isSharedStickyNoteArray = (
	value: unknown,
): value is readonly SharedStickyNote[] =>
	Array.isArray(value) && value.every(isSharedStickyNote);

const isSchemaPayload = (value: unknown): value is SchemaPayload =>
	isRecord(value) &&
	value.version === 3 &&
	typeof value.source === "string" &&
	isPositionRecord(value.positions) &&
	isSharedStickyNoteArray(value.notes);

export const parseSchemaPayload = (
	value: unknown,
): SchemaPayload | null => {
	return isSchemaPayload(value) ? value : null;
};
