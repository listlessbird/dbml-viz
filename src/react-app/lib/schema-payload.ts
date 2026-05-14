import { STICKY_NOTE_COLORS, type SchemaPayload } from "@/types";

export const parseSchemaPayload = (
	value: unknown,
): SchemaPayload | null => {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		return null;
	}
	const payload = value as Record<string, unknown>;
	if (payload.version !== 3 || typeof payload.source !== "string") {
		return null;
	}
	if (
		typeof payload.positions !== "object" ||
		payload.positions === null ||
		Array.isArray(payload.positions)
	) {
		return null;
	}
	if (
		!Object.values(payload.positions).every((position) => {
			if (
				typeof position !== "object" ||
				position === null ||
				Array.isArray(position)
			) {
				return false;
			}
			const record = position as Record<string, unknown>;
			return (
				typeof record.x === "number" &&
				Number.isFinite(record.x) &&
				typeof record.y === "number" &&
				Number.isFinite(record.y)
			);
		})
	) {
		return null;
	}
	if (
		!Array.isArray(payload.notes) ||
		!payload.notes.every((note) => {
			if (typeof note !== "object" || note === null || Array.isArray(note)) {
				return false;
			}
			const record = note as Record<string, unknown>;
			return (
				typeof record.id === "string" &&
				typeof record.text === "string" &&
				typeof record.color === "string" &&
				(STICKY_NOTE_COLORS as readonly string[]).includes(record.color)
			);
		})
	) {
		return null;
	}
	return payload as unknown as SchemaPayload;
};
