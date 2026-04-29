import { getTableNodeLayout } from "@/components/table-node/layout";
import type { DiagramPositions, ParsedSchema } from "@/types";

const FALLBACK_LAYOUT_GAP = 48;
const FALLBACK_LAYOUT_START = Object.freeze({ x: 80, y: 80 });

export interface MissingTablePositionResult {
	readonly tablePositions: DiagramPositions;
	readonly missingTablePositions: DiagramPositions;
	readonly missingTableIds: readonly string[];
}

const computeFallbackAnchor = (
	parsedSchema: ParsedSchema,
	tablePositions: DiagramPositions,
) => {
	let rightmostEdge = 0;
	let topmostY = 0;
	let hasPositionedTables = false;

	for (const table of parsedSchema.tables) {
		const position = tablePositions[table.id];
		if (!position) continue;

		const layout = getTableNodeLayout(table);
		if (!hasPositionedTables) {
			rightmostEdge = position.x + layout.width;
			topmostY = position.y;
			hasPositionedTables = true;
			continue;
		}

		rightmostEdge = Math.max(rightmostEdge, position.x + layout.width);
		topmostY = Math.min(topmostY, position.y);
	}

	if (!hasPositionedTables) {
		return FALLBACK_LAYOUT_START;
	}

	return {
		x: rightmostEdge + FALLBACK_LAYOUT_GAP,
		y: topmostY,
	};
};

export const placeMissingTablePositions = (
	parsedSchema: ParsedSchema,
	tablePositions: DiagramPositions,
): MissingTablePositionResult => {
	const fallbackAnchor = computeFallbackAnchor(parsedSchema, tablePositions);
	const nextTablePositions: DiagramPositions = { ...tablePositions };
	const missingTablePositions: DiagramPositions = {};
	const missingTableIds: string[] = [];
	let nextFallbackY = fallbackAnchor.y;

	for (const table of parsedSchema.tables) {
		if (nextTablePositions[table.id]) continue;

		const position = {
			x: fallbackAnchor.x,
			y: nextFallbackY,
		};
		nextTablePositions[table.id] = position;
		missingTablePositions[table.id] = position;
		missingTableIds.push(table.id);
		nextFallbackY += getTableNodeLayout(table).height + FALLBACK_LAYOUT_GAP;
	}

	return {
		tablePositions: nextTablePositions,
		missingTablePositions,
		missingTableIds,
	};
};
