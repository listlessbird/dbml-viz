import { getTableNodeLayout } from "@/components/table-node/layout";
import type {
	DiagramPositions,
	ParsedSchema,
	TableData,
	TableNodeLayout,
} from "@/types";

const DEFAULT_TABLE_SIZE = Object.freeze({ width: 220, height: 180 });
const CONNECTED_COLUMNS = 6;
const LARGE_CONNECTED_COLUMNS = 10;
const ISOLATED_COLUMNS = 8;
const LARGE_GRAPH_THRESHOLD = 100;
const GAP_X = 100;
const GAP_Y = 100;
const START = Object.freeze({ x: 100, y: 100 });
const MAX_SPIRAL_ITERATIONS = 1000;

export interface TablePlacementRequest {
	readonly parsedSchema: ParsedSchema;
	readonly tablePositions: DiagramPositions;
	readonly tableIdsToPlace?: readonly string[];
	readonly getTableLayout?: (table: TableData) => TableNodeLayout;
}

export interface TablePlacementResult {
	readonly tablePositions: DiagramPositions;
	readonly placedTablePositions: DiagramPositions;
	readonly placedTableIds: readonly string[];
}

type TableRect = {
	readonly id: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
};

const compareByInputOrder =
	(orderByTableId: ReadonlyMap<string, number>) => (left: string, right: string) =>
		(orderByTableId.get(left) ?? 0) - (orderByTableId.get(right) ?? 0);

const getEndpointKeys = (table: TableData): readonly string[] => {
	const keys = [table.id, table.name];
	if (table.schema) keys.push(`${table.schema}.${table.name}`);
	return keys;
};

const buildTableLookup = (tables: readonly TableData[]) => {
	const tableById = new Map<string, TableData>();
	const tableIdByEndpoint = new Map<string, string>();
	const orderByTableId = new Map<string, number>();

	for (let index = 0; index < tables.length; index += 1) {
		const table = tables[index]!;
		tableById.set(table.id, table);
		orderByTableId.set(table.id, index);
		for (const key of getEndpointKeys(table)) {
			tableIdByEndpoint.set(key, table.id);
		}
	}

	return { orderByTableId, tableById, tableIdByEndpoint };
};

const buildConnections = (
	parsedSchema: ParsedSchema,
	tableIdByEndpoint: ReadonlyMap<string, string>,
	orderByTableId: ReadonlyMap<string, number>,
) => {
	const connections = new Map<string, Set<string>>();
	for (const table of parsedSchema.tables) {
		connections.set(table.id, new Set());
	}

	for (const ref of parsedSchema.refs) {
		const sourceId = tableIdByEndpoint.get(ref.from.table);
		const targetId = tableIdByEndpoint.get(ref.to.table);
		if (!sourceId || !targetId || sourceId === targetId) continue;
		connections.get(sourceId)?.add(targetId);
		connections.get(targetId)?.add(sourceId);
	}

	for (const [tableId, connectedIds] of connections) {
		connections.set(
			tableId,
			new Set(Array.from(connectedIds).sort(compareByInputOrder(orderByTableId))),
		);
	}

	return connections;
};

const tableLayoutGetter = (table: TableData): TableNodeLayout =>
	getTableNodeLayout(table);

const getDimensions = (
	tableId: string,
	tableById: ReadonlyMap<string, TableData>,
	getTableLayout: (table: TableData) => TableNodeLayout,
) => {
	const table = tableById.get(tableId);
	if (!table) return DEFAULT_TABLE_SIZE;
	const layout = getTableLayout(table);
	return { width: layout.width, height: layout.height };
};

const toRect = (
	tableId: string,
	position: { readonly x: number; readonly y: number },
	tableById: ReadonlyMap<string, TableData>,
	getTableLayout: (table: TableData) => TableNodeLayout,
): TableRect => {
	const dimensions = getDimensions(tableId, tableById, getTableLayout);
	return {
		id: tableId,
		x: position.x,
		y: position.y,
		width: dimensions.width,
		height: dimensions.height,
	};
};

const rectsOverlapWithGap = (left: TableRect, right: TableRect): boolean =>
	left.x < right.x + right.width + GAP_X &&
	left.x + left.width + GAP_X > right.x &&
	left.y < right.y + right.height + GAP_Y &&
	left.y + left.height + GAP_Y > right.y;

const isOverlapping = (
	tableId: string,
	position: { readonly x: number; readonly y: number },
	occupiedPositions: ReadonlyMap<string, { readonly x: number; readonly y: number }>,
	tableById: ReadonlyMap<string, TableData>,
	getTableLayout: (table: TableData) => TableNodeLayout,
): boolean => {
	const currentRect = toRect(tableId, position, tableById, getTableLayout);
	for (const [occupiedTableId, occupiedPosition] of occupiedPositions) {
		if (occupiedTableId === tableId) continue;
		const occupiedRect = toRect(
			occupiedTableId,
			occupiedPosition,
			tableById,
			getTableLayout,
		);
		if (rectsOverlapWithGap(currentRect, occupiedRect)) return true;
	}
	return false;
};

const findNonOverlappingPosition = (
	tableId: string,
	basePosition: { readonly x: number; readonly y: number },
	occupiedPositions: ReadonlyMap<string, { readonly x: number; readonly y: number }>,
	tableById: ReadonlyMap<string, TableData>,
	getTableLayout: (table: TableData) => TableNodeLayout,
) => {
	const dimensions = getDimensions(tableId, tableById, getTableLayout);
	const spiralStep = Math.max(dimensions.width, dimensions.height) / 2;
	let angle = 0;
	let radius = 0;

	for (let iteration = 0; iteration < MAX_SPIRAL_ITERATIONS; iteration += 1) {
		const position = {
			x: basePosition.x + radius * Math.cos(angle),
			y: basePosition.y + radius * Math.sin(angle),
		};
		if (
			!isOverlapping(
				tableId,
				position,
				occupiedPositions,
				tableById,
				getTableLayout,
			)
		) {
			return position;
		}

		angle += Math.PI / 4;
		if (angle >= Math.PI * 2) {
			angle = 0;
			radius += spiralStep;
		}
	}

	return {
		x: basePosition.x + radius * Math.cos(angle),
		y: basePosition.y + radius * Math.sin(angle),
	};
};

const getGridPosition = (
	tableId: string,
	index: number,
	columns: number,
	startY: number,
	tableById: ReadonlyMap<string, TableData>,
	getTableLayout: (table: TableData) => TableNodeLayout,
	gapScale = 2,
) => {
	const dimensions = getDimensions(tableId, tableById, getTableLayout);
	const row = Math.floor(index / columns);
	const col = index % columns;
	return {
		x: START.x + col * (dimensions.width + GAP_X * gapScale),
		y: startY + row * (dimensions.height + GAP_Y * gapScale),
	};
};

const getBottomEdge = (
	positions: ReadonlyMap<string, { readonly x: number; readonly y: number }>,
	tableById: ReadonlyMap<string, TableData>,
	getTableLayout: (table: TableData) => TableNodeLayout,
) => {
	let bottom: number = START.y;
	for (const [tableId, position] of positions) {
		const dimensions = getDimensions(tableId, tableById, getTableLayout);
		bottom = Math.max(bottom, position.y + dimensions.height);
	}
	return bottom;
};

const getNeighbourAnchor = (
	tableId: string,
	connections: ReadonlyMap<string, ReadonlySet<string>>,
	occupiedPositions: ReadonlyMap<string, { readonly x: number; readonly y: number }>,
	orderByTableId: ReadonlyMap<string, number>,
) => {
	const connectedIds = Array.from(connections.get(tableId) ?? []).sort(
		compareByInputOrder(orderByTableId),
	);
	for (const connectedId of connectedIds) {
		const position = occupiedPositions.get(connectedId);
		if (position) return { tableId: connectedId, position };
	}
	return null;
};

export const placeTables = ({
	parsedSchema,
	tablePositions,
	tableIdsToPlace,
	getTableLayout = tableLayoutGetter,
}: TablePlacementRequest): TablePlacementResult => {
	const { orderByTableId, tableById, tableIdByEndpoint } = buildTableLookup(
		parsedSchema.tables,
	);
	const requestedIds =
		tableIdsToPlace === undefined
			? parsedSchema.tables.map((table) => table.id)
			: tableIdsToPlace;
	const idsToPlace = new Set(
		requestedIds.filter((tableId) => tableById.has(tableId)),
	);
	const connections = buildConnections(
		parsedSchema,
		tableIdByEndpoint,
		orderByTableId,
	);
	const nextTablePositions: DiagramPositions = {};
	const placedTablePositions: DiagramPositions = {};
	const occupiedPositions = new Map<
		string,
		{ readonly x: number; readonly y: number }
	>();

	for (const table of parsedSchema.tables) {
		const position = tablePositions[table.id];
		if (!position || idsToPlace.has(table.id)) continue;
		nextTablePositions[table.id] = position;
		occupiedPositions.set(table.id, position);
	}

	const placeTable = (
		tableId: string,
		basePosition: { readonly x: number; readonly y: number },
	) => {
		if (!idsToPlace.has(tableId) || occupiedPositions.has(tableId)) return;
		const position = findNonOverlappingPosition(
			tableId,
			basePosition,
			occupiedPositions,
			tableById,
			getTableLayout,
		);
		nextTablePositions[tableId] = position;
		placedTablePositions[tableId] = position;
		occupiedPositions.set(tableId, position);
	};

	const connectedIds = Array.from(idsToPlace).filter(
		(tableId) => (connections.get(tableId)?.size ?? 0) > 0,
	);
	connectedIds.sort((left, right) => {
		const degreeDelta =
			(connections.get(right)?.size ?? 0) - (connections.get(left)?.size ?? 0);
		return degreeDelta === 0
			? compareByInputOrder(orderByTableId)(left, right)
			: degreeDelta;
	});

	const isolatedIds = Array.from(idsToPlace)
		.filter((tableId) => (connections.get(tableId)?.size ?? 0) === 0)
		.sort(compareByInputOrder(orderByTableId));

	const positionConnectedTable = (
		tableId: string,
		basePosition: { readonly x: number; readonly y: number },
	) => {
		if (!idsToPlace.has(tableId) || occupiedPositions.has(tableId)) return;
		placeTable(tableId, basePosition);
		const position = occupiedPositions.get(tableId);
		if (!position) return;

		const connected = Array.from(connections.get(tableId) ?? []).filter((id) =>
			idsToPlace.has(id),
		);
		const angleStep =
			connected.length === 0 ? Math.PI * 2 : (Math.PI * 2) / connected.length;
		for (let index = 0; index < connected.length; index += 1) {
			const connectedTableId = connected[index]!;
			if (occupiedPositions.has(connectedTableId)) continue;
			const source = getDimensions(tableId, tableById, getTableLayout);
			const target = getDimensions(connectedTableId, tableById, getTableLayout);
			const angle = index * angleStep;
			positionConnectedTable(connectedTableId, {
				x:
					position.x +
					Math.cos(angle) * ((source.width + target.width) / 2 + GAP_X * 2),
				y:
					position.y +
					Math.sin(angle) *
						((source.height + target.height) / 2 + GAP_Y * 2),
			});
		}
	};

	if (connectedIds.length >= LARGE_GRAPH_THRESHOLD) {
		for (let index = 0; index < connectedIds.length; index += 1) {
			const tableId = connectedIds[index]!;
			placeTable(
				tableId,
				getGridPosition(
					tableId,
					index,
					LARGE_CONNECTED_COLUMNS,
					START.y,
					tableById,
					getTableLayout,
					1,
				),
			);
		}
	} else {
		for (let index = 0; index < connectedIds.length; index += 1) {
			const tableId = connectedIds[index]!;
			if (occupiedPositions.has(tableId)) continue;
			const anchor = getNeighbourAnchor(
				tableId,
				connections,
				occupiedPositions,
				orderByTableId,
			);
			const basePosition =
				anchor === null
					? getGridPosition(
							tableId,
							index,
							CONNECTED_COLUMNS,
							START.y,
							tableById,
							getTableLayout,
						)
					: {
							x:
								anchor.position.x +
								getDimensions(anchor.tableId, tableById, getTableLayout).width +
								GAP_X * 2,
							y: anchor.position.y,
						};
			positionConnectedTable(tableId, basePosition);
		}
	}

	const isolatedStartY =
		getBottomEdge(occupiedPositions, tableById, getTableLayout) + GAP_Y * 2;
	for (let index = 0; index < isolatedIds.length; index += 1) {
		const tableId = isolatedIds[index]!;
		placeTable(
			tableId,
			getGridPosition(
				tableId,
				index,
				ISOLATED_COLUMNS,
				isolatedStartY,
				tableById,
				getTableLayout,
				1,
			),
		);
	}

	return {
		tablePositions: nextTablePositions,
		placedTablePositions,
		placedTableIds: Object.keys(placedTablePositions),
	};
};
