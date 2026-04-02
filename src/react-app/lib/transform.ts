import { MarkerType, Position } from "@xyflow/react";

import type {
	DiagramEdge,
	DiagramNode,
	DiagramNodeSize,
	DiagramPositions,
	ParsedSchema,
	RefType,
	TableData,
} from "@/types";

export const getSourceHandleId = (tableId: string, columnName: string) =>
	`${tableId}-${columnName}-source`;

export const getTargetHandleId = (tableId: string, columnName: string) =>
	`${tableId}-${columnName}-target`;

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

export const estimateTableSize = (
	table: TableData,
	measurement?: DiagramNodeSize,
): DiagramNodeSize => {
	if (measurement) {
		return measurement;
	}

	return {
		width: 320,
		height: 82 + table.columns.length * 34,
	};
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
}

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
	const connectedColumnsByTable = new Map<string, Set<string>>();

	for (const ref of parsed.refs) {
		const fromColumns = connectedColumnsByTable.get(ref.from.table) ?? new Set<string>();
		fromColumns.add(ref.from.column);
		connectedColumnsByTable.set(ref.from.table, fromColumns);

		const toColumns = connectedColumnsByTable.get(ref.to.table) ?? new Set<string>();
		toColumns.add(ref.to.column);
		connectedColumnsByTable.set(ref.to.table, toColumns);
	}

	const fallbackAnchor = getFallbackAnchor(positions);
	let fallbackIndex = 0;

	const nodes = parsed.tables.map((table) => {
		const size = estimateTableSize(table, measurements[table.id]);
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
				onMeasure: options.onMeasure,
			},
			sourcePosition: Position.Right,
			targetPosition: Position.Left,
			width: size.width,
			height: size.height,
		} satisfies DiagramNode;
	});

	const edges = parsed.refs.map((ref) => ({
		id: ref.id,
		source: ref.from.table,
		target: ref.to.table,
		sourceHandle: getSourceHandleId(ref.from.table, ref.from.column),
		targetHandle: getTargetHandleId(ref.to.table, ref.to.column),
		type: "relationship",
		data: {
			from: ref.from,
			to: ref.to,
			relationText: relationText(ref.type),
		},
		label: relationLabel(ref.type),
		markerEnd: {
			type: MarkerType.ArrowClosed,
			width: 18,
			height: 18,
			color: "var(--primary)",
		},
		style: {
			stroke: "var(--primary)",
			strokeWidth: 1.4,
		},
	} satisfies DiagramEdge));

	return {
		nodes,
		edges,
		missingPositionIds: nodes
			.filter((node) => !(node.id in positions))
			.map((node) => node.id),
	};
};
