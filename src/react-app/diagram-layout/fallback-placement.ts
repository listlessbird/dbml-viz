import type { DiagramPositions, ParsedSchema } from "@/types";
import { placeTables } from "@/diagram-layout/table-placer";

export interface MissingTablePositionResult {
	readonly tablePositions: DiagramPositions;
	readonly missingTablePositions: DiagramPositions;
	readonly missingTableIds: readonly string[];
}

export const placeMissingTablePositions = (
	parsedSchema: ParsedSchema,
	tablePositions: DiagramPositions,
): MissingTablePositionResult => {
	const missingTableIds = parsedSchema.tables
		.filter((table) => !tablePositions[table.id])
		.map((table) => table.id);
	const placement = placeTables({
		parsedSchema,
		tablePositions,
		tableIdsToPlace: missingTableIds,
	});

	return {
		tablePositions: placement.tablePositions,
		missingTablePositions: placement.placedTablePositions,
		missingTableIds: placement.placedTableIds,
	};
};
