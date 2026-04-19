import { MarkerType, Position } from "@xyflow/react";

import {
	getRefSourceHandleId,
	getRefTargetHandleId,
} from "@/lib/relation-handles";
import {
	countColumnsWithConstraintBadges,
	getColumnConstraintBadges,
} from "@/lib/table-constraints";
import type {
	DiagramEdge,
	DiagramNode,
	DiagramNodeSize,
	DiagramPositions,
	ParsedSchema,
	RelationAnchorData,
	RefType,
	TableData,
} from "@/types";

export const relationLabel = (type: RefType) => {
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

export const relationText = (type: RefType) => {
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

const hashString = (value: string) =>
	Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0);

const chartAccents = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
] as const;

const accentFromTable = (tableId: string) =>
	chartAccents[hashString(tableId) % chartAccents.length];

const MIN_TABLE_WIDTH = 260;
const MAX_TABLE_WIDTH = 420;
const ESTIMATED_CHAR_WIDTH = 6.1;
const TABLE_WIDTH_PADDING = 168;
const ESTIMATED_TABLE_HEADER_HEIGHT = 60;
const ESTIMATED_TABLE_NOTE_HEIGHT = 18;
const ESTIMATED_COLUMN_ROW_HEIGHT = 28;
const ESTIMATED_BADGE_ROW_HEIGHT = 18;
const ESTIMATED_COLUMN_NOTE_HEIGHT = 18;

const estimateTableWidth = (table: TableData) => {
	const longestContentLength = Math.max(
		table.name.length,
		...table.columns.map((column) =>
			Math.max(
				column.name.length + column.type.length,
				column.type.length + (column.unique ? 9 : 0) + (column.notNull ? 10 : 8),
			),
		),
	);

	return Math.max(
		MIN_TABLE_WIDTH,
		Math.min(
			MAX_TABLE_WIDTH,
			Math.round(TABLE_WIDTH_PADDING + longestContentLength * ESTIMATED_CHAR_WIDTH),
		),
	);
};

export const estimateTableSize = (
	table: TableData,
	measurement?: DiagramNodeSize,
): DiagramNodeSize => {
	if (measurement) {
		return measurement;
	}

	return {
		width: estimateTableWidth(table),
		height:
			ESTIMATED_TABLE_HEADER_HEIGHT +
			(table.note ? ESTIMATED_TABLE_NOTE_HEIGHT : 0) +
			table.columns.length * ESTIMATED_COLUMN_ROW_HEIGHT +
			countColumnsWithConstraintBadges(table) * ESTIMATED_BADGE_ROW_HEIGHT +
			table.columns.filter((column) => column.note).length * ESTIMATED_COLUMN_NOTE_HEIGHT,
	};
};

const estimateCompositeHandleOffsets = (
	table: TableData,
	relationAnchors: readonly RelationAnchorData[],
) => {
	if (relationAnchors.length === 0) {
		return {};
	}

	const badgeCountsByColumn = new Map(
		Array.from(getColumnConstraintBadges(table), ([columnName, badges]) => [
			columnName,
			badges.length,
		]),
	);
	const columnOffsets = new Map<string, { top: number; bottom: number }>();
	let nextRowTop =
		ESTIMATED_TABLE_HEADER_HEIGHT + (table.note ? ESTIMATED_TABLE_NOTE_HEIGHT : 0);

	for (const column of table.columns) {
		const badgeCount = badgeCountsByColumn.get(column.name) ?? 0;
		const rowHeight =
			ESTIMATED_COLUMN_ROW_HEIGHT +
			badgeCount * ESTIMATED_BADGE_ROW_HEIGHT +
			(column.note ? ESTIMATED_COLUMN_NOTE_HEIGHT : 0);

		columnOffsets.set(column.name, {
			top: nextRowTop,
			bottom: nextRowTop + rowHeight,
		});
		nextRowTop += rowHeight;
	}

	return Object.fromEntries(
		relationAnchors.flatMap((anchor) => {
			if (anchor.columns.length <= 1) {
				return [];
			}

			const offsets = anchor.columns
				.map((columnName) => columnOffsets.get(columnName))
				.filter((offset): offset is { top: number; bottom: number } => offset !== undefined);

			if (offsets.length === 0) {
				return [];
			}

			const top = Math.min(...offsets.map((offset) => offset.top));
			const bottom = Math.max(...offsets.map((offset) => offset.bottom));
			return [[anchor.id, (top + bottom) / 2] as const];
		}),
	);
};

const getFallbackAnchor = (positions: DiagramPositions) => {
	const entries = Object.values(positions);

	if (entries.length === 0) {
		return {
			x: 80,
			y: 80,
		};
	}

	return {
		x: Math.max(...entries.map((position) => position.x)) + 420,
		y: Math.min(...entries.map((position) => position.y)),
	};
};

interface BuildDiagramOptions {
	readonly positions?: DiagramPositions;
	readonly measurements?: Record<string, DiagramNodeSize>;
	readonly onMeasure?: (nodeId: string, size: DiagramNodeSize) => void;
	readonly search?: {
		readonly matchedTableIds: ReadonlySet<string>;
		readonly relatedTableIds: ReadonlySet<string>;
		readonly highlightedEdgeIds: ReadonlySet<string>;
	};
}

const addColumnsToMap = (
	columnsByTable: Map<string, Set<string>>,
	tableId: string,
	columns: readonly string[],
) => {
	const tableColumns = columnsByTable.get(tableId) ?? new Set<string>();
	columns.forEach((column) => tableColumns.add(column));
	columnsByTable.set(tableId, tableColumns);
};

const buildRelationAnchors = (parsed: ParsedSchema) => {
	const anchorsByTable = new Map<string, RelationAnchorData[]>();

	for (const ref of parsed.refs) {
		if (ref.from.columns.length > 1) {
			const anchors = anchorsByTable.get(ref.from.table) ?? [];
			anchors.push({
				id: getRefSourceHandleId(ref),
				columns: ref.from.columns,
				side: "source",
			});
			anchorsByTable.set(ref.from.table, anchors);
		}

		if (ref.to.columns.length > 1) {
			const anchors = anchorsByTable.get(ref.to.table) ?? [];
			anchors.push({
				id: getRefTargetHandleId(ref),
				columns: ref.to.columns,
				side: "target",
			});
			anchorsByTable.set(ref.to.table, anchors);
		}
	}

	return anchorsByTable;
};

export const buildDiagram = (
	parsed: ParsedSchema,
	options: BuildDiagramOptions = {},
): {
	nodes: DiagramNode[];
	edges: DiagramEdge[];
	missingPositionIds: string[];
} => {
	const positions = options.positions ?? {};
	const measurements = options.measurements ?? {};
	const matchedTableIds = options.search?.matchedTableIds ?? new Set<string>();
	const relatedTableIds = options.search?.relatedTableIds ?? new Set<string>();
	const highlightedEdgeIds = options.search?.highlightedEdgeIds ?? new Set<string>();
	const hasSearchHighlights = matchedTableIds.size > 0;
	const connectedColumnsByTable = new Map<string, Set<string>>();
	const relationAnchorsByTable = buildRelationAnchors(parsed);

	for (const ref of parsed.refs) {
		addColumnsToMap(connectedColumnsByTable, ref.from.table, ref.from.columns);
		addColumnsToMap(connectedColumnsByTable, ref.to.table, ref.to.columns);
	}

	const fallbackAnchor = getFallbackAnchor(positions);
	let fallbackIndex = 0;

	const nodes = parsed.tables.map((table) => {
		const size = estimateTableSize(table, measurements[table.id]);
		const relationAnchors = relationAnchorsByTable.get(table.id) ?? [];
		const fallbackPosition = {
			x: fallbackAnchor.x + (fallbackIndex % 2) * 48,
			y: fallbackAnchor.y + fallbackIndex * 140,
		};
		const position = positions[table.id] ?? fallbackPosition;

		if (!positions[table.id]) {
			fallbackIndex += 1;
		}

		return {
			id: table.id,
			type: "table",
			position,
			data: {
				table,
				accent: accentFromTable(table.id),
				connectedColumns: Array.from(connectedColumnsByTable.get(table.id) ?? []),
				isSearchMatch: matchedTableIds.has(table.id),
				isSearchRelated: relatedTableIds.has(table.id),
				isSearchDimmed:
					hasSearchHighlights &&
					!matchedTableIds.has(table.id) &&
					!relatedTableIds.has(table.id),
				relationAnchors,
				compositeHandleOffsets: estimateCompositeHandleOffsets(table, relationAnchors),
				onMeasure: options.onMeasure,
			},
			sourcePosition: Position.Right,
			targetPosition: Position.Left,
			width: size.width,
			height: size.height,
		} satisfies DiagramNode;
	});

	const edges = parsed.refs.map((ref) => {
		const isSearchMatch = highlightedEdgeIds.has(ref.id);
		const isSearchDimmed = hasSearchHighlights && !isSearchMatch;
		const stroke = isSearchDimmed
			? "color-mix(in oklab, var(--muted-foreground) 28%, transparent)"
			: "var(--primary)";

		return {
			id: ref.id,
			source: ref.from.table,
			target: ref.to.table,
			sourceHandle: getRefSourceHandleId(ref),
			targetHandle: getRefTargetHandleId(ref),
			type: "relationship",
			data: {
				from: ref.from,
				to: ref.to,
				relationText: relationText(ref.type),
				isSearchMatch,
				isSearchDimmed,
				name: ref.name,
				onDelete: ref.onDelete,
				onUpdate: ref.onUpdate,
			},
			label: relationLabel(ref.type),
			markerEnd: {
				type: MarkerType.ArrowClosed,
				width: 18,
				height: 18,
				color: stroke,
			},
			style: {
				stroke,
				strokeWidth: isSearchMatch ? 1.9 : 1.4,
				opacity: isSearchDimmed ? 0.4 : 1,
			},
		} satisfies DiagramEdge;
	});

	return {
		nodes,
		edges,
		missingPositionIds: nodes
			.filter((node) => !(node.id in positions))
			.map((node) => node.id),
	};
};
