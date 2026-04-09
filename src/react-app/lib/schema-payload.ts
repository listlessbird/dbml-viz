import type { SchemaPayload, SharePosition } from "@/types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const isSharePosition = (value: unknown): value is SharePosition =>
	isRecord(value) &&
	typeof value.x === "number" &&
	Number.isFinite(value.x) &&
	typeof value.y === "number" &&
	Number.isFinite(value.y);

const isPositionRecord = (
	value: unknown,
): value is Record<string, SharePosition> => {
	if (!isRecord(value)) {
		return false;
	}

	return Object.values(value).every(isSharePosition);
};

const isSchemaPayload = (
	value: unknown,
): value is SchemaPayload =>
	isRecord(value) &&
	value.version === 2 &&
	typeof value.source === "string" &&
	isPositionRecord(value.positions);

export const parseSchemaPayload = (
	value: unknown,
): SchemaPayload | null => {
	return isSchemaPayload(value) ? value : null;
};
