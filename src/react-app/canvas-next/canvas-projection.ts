import { MarkerType, Position } from "@xyflow/react";

import {
	getCompositeHandleOffsets,
	getTableNodeLayout,
} from "@/components/table-node/layout";
import {
	TEMPORARY_CURSOR_NODE_ID,
	TEMPORARY_RELATIONSHIP_EDGE_ID,
	type ProjectionRuntimeState,
} from "@/canvas-next/canvas-runtime-store";
import { buildSchemaIndexes, type SchemaIndexes } from "@/schema-model/schema-indexes";
import type { ResolvedRelationship } from "@/schema-model/relation-anchors";
import type {
	CanvasEdge,
	CanvasNode,
	DiagramEdge,
	DiagramNode,
	DiagramPositions,
	ParsedSchema,
	RefType,
	RelationAnchorData,
	TableData,
	TemporaryCursorNode,
	TemporaryRelationshipEdge,
} from "@/types";

export interface CanvasProjectionInput {
	readonly parsedSchema: ParsedSchema;
	readonly tablePositions: DiagramPositions;
}

export interface CanvasProjection {
	readonly nodes: CanvasNode[];
	readonly edges: CanvasEdge[];
	readonly missingPositionIds: readonly string[];
}

const FALLBACK_LAYOUT_GAP = 48;
const FALLBACK_LAYOUT_START = Object.freeze({ x: 80, y: 80 });

const chartAccents = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
] as const;

const hashString = (value: string) =>
	Array.from(value).reduce(
		(hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0,
		0,
	);

const accentFromTable = (tableId: string) =>
	chartAccents[hashString(tableId) % chartAccents.length];

const relationLabel = (type: RefType) => {
	switch (type) {
		case "one_to_one":
			return "1:1";
		case "one_to_many":
			return "1:N";
		case "many_to_many":
			return "N:M";
		default:
			return "N:1";
	}
};

const relationText = (type: RefType) => {
	switch (type) {
		case "one_to_one":
			return "one to one";
		case "one_to_many":
			return "one to many";
		case "many_to_many":
			return "many to many";
		default:
			return "many to one";
	}
};

const computeFallbackAnchor = (
	parsed: ParsedSchema,
	positions: DiagramPositions,
	tableLayoutById: ReadonlyMap<string, ReturnType<typeof getTableNodeLayout>>,
) => {
	let rightmostEdge = 0;
	let topmostY = 0;
	let hasPositionedNodes = false;

	for (const table of parsed.tables) {
		const position = positions[table.id];
		const layout = tableLayoutById.get(table.id);
		if (!position || !layout) continue;

		if (!hasPositionedNodes) {
			rightmostEdge = position.x + layout.width;
			topmostY = position.y;
			hasPositionedNodes = true;
			continue;
		}

		rightmostEdge = Math.max(rightmostEdge, position.x + layout.width);
		topmostY = Math.min(topmostY, position.y);
	}

	if (!hasPositionedNodes) {
		return FALLBACK_LAYOUT_START;
	}

	return {
		x: rightmostEdge + FALLBACK_LAYOUT_GAP,
		y: topmostY,
	};
};

const collectCompositeAnchors = (
	indexes: SchemaIndexes,
	tableId: string,
): RelationAnchorData[] => {
	const anchors = indexes.relationAnchorsByTableId.get(tableId);
	if (!anchors) return [];
	const composite: RelationAnchorData[] = [];
	for (const anchor of anchors) {
		if (anchor.columns.length <= 1) continue;
		composite.push({
			id: anchor.id,
			columns: anchor.columns,
			side: anchor.side,
		});
	}
	return composite;
};

const collectConnectedColumns = (
	indexes: SchemaIndexes,
	tableId: string,
): readonly string[] => {
	const refs = indexes.refsByTableId.get(tableId);
	if (!refs) return [];
	const columns = new Set<string>();
	for (const ref of refs) {
		const isFromTable = ref.from.table === tableId;
		const endpoint = isFromTable ? ref.from : ref.to;
		for (const column of endpoint.columns) {
			columns.add(column);
		}
	}
	return Array.from(columns);
};

const buildTableNode = (
	table: TableData,
	options: {
		readonly position: { readonly x: number; readonly y: number };
		readonly layout: ReturnType<typeof getTableNodeLayout>;
		readonly connectedColumns: readonly string[];
		readonly relationAnchors: readonly RelationAnchorData[];
		readonly activeRelationColumns?: readonly string[];
	},
): DiagramNode => ({
	id: table.id,
	type: "table",
	position: { x: options.position.x, y: options.position.y },
	data: {
		table,
		layout: options.layout,
		accent: accentFromTable(table.id),
		connectedColumns: options.connectedColumns,
		isSearchMatch: false,
		isSearchRelated: false,
		isSearchDimmed: false,
		relationAnchors: options.relationAnchors,
		compositeHandleOffsets: getCompositeHandleOffsets(
			table,
			options.relationAnchors,
		),
		...(options.activeRelationColumns !== undefined
			? {
					activeRelationColumns: options.activeRelationColumns,
					isRelationContextActive: true,
				}
			: {}),
	},
	sourcePosition: Position.Right,
	targetPosition: Position.Left,
	width: options.layout.width,
	height: options.layout.height,
});

const buildRelationshipEdge = (
	resolved: ResolvedRelationship,
	activeTableIds: ReadonlySet<string>,
): DiagramEdge => {
	const stroke = "var(--primary)";
	const isRelationSourceActive = activeTableIds.has(resolved.from.tableId);
	const isRelationTargetActive = activeTableIds.has(resolved.to.tableId);
	const isRelationActive = isRelationSourceActive || isRelationTargetActive;
	return {
		id: resolved.ref.id,
		source: resolved.from.tableId,
		target: resolved.to.tableId,
		sourceHandle: resolved.from.id,
		targetHandle: resolved.to.id,
		type: "relationship",
		data: {
			from: resolved.ref.from,
			to: resolved.ref.to,
			relationText: relationText(resolved.ref.type),
			isSearchMatch: false,
			isSearchDimmed: false,
			...(isRelationActive
				? {
						isRelationActive: true,
						isRelationSourceActive,
						isRelationTargetActive,
					}
				: {}),
			...(resolved.ref.name !== undefined ? { name: resolved.ref.name } : {}),
			...(resolved.ref.onDelete !== undefined
				? { onDelete: resolved.ref.onDelete }
				: {}),
			...(resolved.ref.onUpdate !== undefined
				? { onUpdate: resolved.ref.onUpdate }
				: {}),
		},
		label: relationLabel(resolved.ref.type),
		markerEnd: {
			type: MarkerType.ArrowClosed,
			width: 18,
			height: 18,
			color: stroke,
		},
		style: {
			stroke,
			strokeWidth: isRelationActive ? 2.3 : 1.4,
			opacity: 1,
		},
	};
};

const collectActiveRelationColumns = (
	resolvedRelationships: readonly ResolvedRelationship[],
	activeTableIds: ReadonlySet<string>,
): ReadonlyMap<string, readonly string[]> => {
	if (activeTableIds.size === 0) {
		return new Map();
	}
	const columnsByTable = new Map<string, Set<string>>();
	for (const resolved of resolvedRelationships) {
		const isFromActive = activeTableIds.has(resolved.from.tableId);
		const isToActive = activeTableIds.has(resolved.to.tableId);
		if (!isFromActive && !isToActive) continue;

		const fromColumns =
			columnsByTable.get(resolved.from.tableId) ?? new Set<string>();
		for (const column of resolved.from.columns) {
			fromColumns.add(column);
		}
		columnsByTable.set(resolved.from.tableId, fromColumns);

		const toColumns =
			columnsByTable.get(resolved.to.tableId) ?? new Set<string>();
		for (const column of resolved.to.columns) {
			toColumns.add(column);
		}
		columnsByTable.set(resolved.to.tableId, toColumns);
	}
	const frozen = new Map<string, readonly string[]>();
	for (const [tableId, columns] of columnsByTable.entries()) {
		frozen.set(tableId, Array.from(columns));
	}
	return frozen;
};

const isResolvedReachable = (
	resolved: ResolvedRelationship,
	tablesById: ReadonlyMap<string, TableData>,
) =>
	tablesById.has(resolved.from.tableId) &&
	tablesById.has(resolved.to.tableId);

const buildTemporaryProjection = (
	runtime: ProjectionRuntimeState,
	tablesById: ReadonlyMap<string, TableData>,
): {
	readonly nodes: readonly TemporaryCursorNode[];
	readonly edges: readonly TemporaryRelationshipEdge[];
} => {
	const preview = runtime.temporaryRelationship;
	if (!preview || !tablesById.has(preview.sourceTableId)) {
		return { nodes: [], edges: [] };
	}

	const targetTableId =
		preview.targetTableId && tablesById.has(preview.targetTableId)
			? preview.targetTableId
			: null;
	const shouldUseCursor = targetTableId === null && preview.cursorPosition !== null;
	const nodes: TemporaryCursorNode[] = shouldUseCursor
		? [
				{
					id: TEMPORARY_CURSOR_NODE_ID,
					type: "temporaryCursor",
					position: preview.cursorPosition!,
					data: {},
					draggable: false,
					selectable: false,
				},
			]
		: [];
	const target = targetTableId ?? (shouldUseCursor ? TEMPORARY_CURSOR_NODE_ID : null);
	if (!target) {
		return { nodes, edges: [] };
	}

	return {
		nodes,
		edges: [
			{
				id: TEMPORARY_RELATIONSHIP_EDGE_ID,
				type: "temporaryRelationship",
				source: preview.sourceTableId,
				target,
				data: {
					sourceTableId: preview.sourceTableId,
					...(targetTableId !== null ? { targetTableId } : {}),
				},
				selectable: false,
				animated: true,
				style: {
					stroke: "var(--muted-foreground)",
					strokeDasharray: "6 4",
				},
			},
		],
	};
};

export function buildCanvasProjection(
	diagram: CanvasProjectionInput,
	runtime: ProjectionRuntimeState,
): CanvasProjection {
	const { parsedSchema, tablePositions } = diagram;
	const indexes = buildSchemaIndexes(parsedSchema);
	const tableLayoutById = new Map(
		parsedSchema.tables.map(
			(table) => [table.id, getTableNodeLayout(table)] as const,
		),
	);

	const activeTableIds = new Set(
		runtime.activeRelationTableIds.filter((id) => indexes.tablesById.has(id)),
	);
	const activeColumnsByTable = collectActiveRelationColumns(
		indexes.relationships,
		activeTableIds,
	);

	const fallbackAnchor = computeFallbackAnchor(
		parsedSchema,
		tablePositions,
		tableLayoutById,
	);
	let nextFallbackY = fallbackAnchor.y;
	const missingPositionIds: string[] = [];

	const nodes: CanvasNode[] = parsedSchema.tables.map((table) => {
		const layout = tableLayoutById.get(table.id)!;
		const committed = tablePositions[table.id];
		const position = committed ?? {
			x: fallbackAnchor.x,
			y: nextFallbackY,
		};
		if (!committed) {
			missingPositionIds.push(table.id);
			nextFallbackY += layout.height + FALLBACK_LAYOUT_GAP;
		}

		const activeColumns = activeColumnsByTable.get(table.id);
		return buildTableNode(table, {
			position,
			layout,
			connectedColumns: collectConnectedColumns(indexes, table.id),
			relationAnchors: collectCompositeAnchors(indexes, table.id),
			...(activeColumns !== undefined
				? { activeRelationColumns: activeColumns }
				: {}),
		});
	});

	const edges: CanvasEdge[] = [];
	for (const resolved of indexes.relationships) {
		if (!isResolvedReachable(resolved, indexes.tablesById)) continue;
		edges.push(buildRelationshipEdge(resolved, activeTableIds));
	}
	const temporaryProjection = buildTemporaryProjection(
		runtime,
		indexes.tablesById,
	);

	return {
		nodes: [...nodes, ...temporaryProjection.nodes],
		edges: [...edges, ...temporaryProjection.edges],
		missingPositionIds,
	};
}
