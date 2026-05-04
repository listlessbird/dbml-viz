import { getTableNodeLayout } from "@/components/table-node/layout";
import type {
	DiagramLayoutAlgorithm,
	DiagramPositions,
	ParsedSchema,
	TableData,
} from "@/types";
import { placeTables } from "@/diagram-layout/table-placer";

export interface DiagramAutoLayoutRequest {
	readonly parsedSchema: ParsedSchema;
	readonly tablePositions: DiagramPositions;
	readonly algorithm: DiagramLayoutAlgorithm;
}

export interface DiagramLayoutDiagnostic {
	readonly message: string;
}

export type DiagramAutoLayoutResult =
	| {
			readonly ok: true;
			readonly tablePositions: DiagramPositions;
	  }
	| {
			readonly ok: false;
			readonly diagnostic: DiagramLayoutDiagnostic;
	  };

export interface TableOverlapPair {
	readonly firstTableId: string;
	readonly secondTableId: string;
}

export interface TableOverlapResult {
	readonly hasOverlaps: boolean;
	readonly overlappingTableIds: readonly string[];
	readonly overlapPairs: readonly TableOverlapPair[];
}

const diagnosticFromError = (error: unknown): DiagramLayoutDiagnostic => ({
	message:
		error instanceof Error
			? error.message
			: "Unable to auto-layout diagram.",
});

const tableRight = (table: TableData, position: { readonly x: number }) =>
	position.x + getTableNodeLayout(table).width;

const tableBottom = (table: TableData, position: { readonly y: number }) =>
	position.y + getTableNodeLayout(table).height;

export interface MovedTableOverlapRequest {
	readonly parsedSchema: ParsedSchema;
	readonly tablePositions: DiagramPositions;
	readonly movedTableId: string;
	readonly previousResult: TableOverlapResult;
}

const tablesOverlap = (
	leftTable: TableData,
	leftPosition: { readonly x: number; readonly y: number },
	rightTable: TableData,
	rightPosition: { readonly x: number; readonly y: number },
) =>
	leftPosition.x < tableRight(rightTable, rightPosition) &&
	tableRight(leftTable, leftPosition) > rightPosition.x &&
	leftPosition.y < tableBottom(rightTable, rightPosition) &&
	tableBottom(leftTable, leftPosition) > rightPosition.y;

export const updateTableOverlapForMovedTable = ({
	parsedSchema,
	tablePositions,
	movedTableId,
	previousResult,
}: MovedTableOverlapRequest): TableOverlapResult => {
	const tableById = new Map(parsedSchema.tables.map((table) => [table.id, table]));
	const movedTable = tableById.get(movedTableId);
	const movedPosition = tablePositions[movedTableId];

	const carryOverPairs: TableOverlapPair[] = previousResult.overlapPairs.filter(
		(pair) =>
			pair.firstTableId !== movedTableId && pair.secondTableId !== movedTableId,
	);

	const newPairs: TableOverlapPair[] = [];
	if (movedTable && movedPosition) {
		for (const otherTable of parsedSchema.tables) {
			if (otherTable.id === movedTableId) continue;
			const otherPosition = tablePositions[otherTable.id];
			if (!otherPosition) continue;
			if (
				tablesOverlap(movedTable, movedPosition, otherTable, otherPosition)
			) {
				newPairs.push({
					firstTableId: movedTableId,
					secondTableId: otherTable.id,
				});
			}
		}
	}

	const overlapPairs = [...carryOverPairs, ...newPairs];
	const overlappingTableIds = new Set<string>();
	for (const pair of overlapPairs) {
		overlappingTableIds.add(pair.firstTableId);
		overlappingTableIds.add(pair.secondTableId);
	}

	return {
		hasOverlaps: overlapPairs.length > 0,
		overlappingTableIds: Array.from(overlappingTableIds),
		overlapPairs,
	};
};

export const detectOverlappingTablePositions = (
	parsedSchema: ParsedSchema,
	tablePositions: DiagramPositions,
): TableOverlapResult => {
	const positionedTables = parsedSchema.tables
		.flatMap((table) => {
			const position = tablePositions[table.id];
			return position ? [{ table, position }] : [];
		})
		.sort((left, right) => left.position.x - right.position.x);
	const overlapPairs: TableOverlapPair[] = [];
	const overlappingTableIds = new Set<string>();

	for (let index = 0; index < positionedTables.length; index += 1) {
		const current = positionedTables[index]!;
		const currentRight = tableRight(current.table, current.position);
		const currentBottom = tableBottom(current.table, current.position);

		for (
			let candidateIndex = index + 1;
			candidateIndex < positionedTables.length;
			candidateIndex += 1
		) {
			const candidate = positionedTables[candidateIndex]!;
			if (candidate.position.x >= currentRight) break;

			if (
				current.position.y < tableBottom(candidate.table, candidate.position) &&
				currentBottom > candidate.position.y
			) {
				overlapPairs.push({
					firstTableId: current.table.id,
					secondTableId: candidate.table.id,
				});
				overlappingTableIds.add(current.table.id);
				overlappingTableIds.add(candidate.table.id);
			}
		}
	}

	return {
		hasOverlaps: overlapPairs.length > 0,
		overlappingTableIds: Array.from(overlappingTableIds),
		overlapPairs,
	};
};

export const runDiagramAutoLayout = async (
	request: DiagramAutoLayoutRequest,
): Promise<DiagramAutoLayoutResult> => {
	try {
		return {
			ok: true,
			tablePositions: placeTables({
				parsedSchema: request.parsedSchema,
				tablePositions: request.tablePositions,
			}).tablePositions,
		};
	} catch (error) {
		return {
			ok: false,
			diagnostic: diagnosticFromError(error),
		};
	}
};

export const repairOverlappingTablePositions = async (
	request: DiagramAutoLayoutRequest,
): Promise<DiagramAutoLayoutResult> => {
	const overlap = detectOverlappingTablePositions(
		request.parsedSchema,
		request.tablePositions,
	);
	if (!overlap.hasOverlaps) {
		return {
			ok: true,
			tablePositions: request.tablePositions,
		};
	}

	return runDiagramAutoLayout(request);
};
