import {
	measureLineStats,
	measureNaturalWidth,
	prepareWithSegments,
	type PrepareOptions,
	type PreparedTextWithSegments,
} from "@chenglou/pretext";

import { tableNodeMetrics } from "@/components/table-node/metrics";
import type { RelationAnchorData, TableData, TableNodeLayout } from "@/types";

type RowBounds = {
	readonly top: number;
	readonly bottom: number;
};

type PreparedBlock = {
	readonly naturalWidth: number;
	readonly prepared: PreparedTextWithSegments;
};

type CachedTableLayout = {
	readonly height: number;
	readonly rowBoundsByColumn: ReadonlyMap<string, RowBounds>;
	readonly typeColumnWidth: number;
	readonly width: number;
};

let cachedLayouts = new WeakMap<TableData, CachedTableLayout>();
let cachedKindBlock: PreparedBlock | null = null;

function prepareBlock(
	text: string,
	font: string,
	options?: PrepareOptions,
): PreparedBlock {
	const prepared = prepareWithSegments(text, font, options);
	return {
		naturalWidth: measureNaturalWidth(prepared),
		prepared,
	};
}

function getKindBlock(): PreparedBlock {
	if (cachedKindBlock !== null) return cachedKindBlock;
	cachedKindBlock = prepareBlock("TABLE", tableNodeMetrics.header.kind.font);
	return cachedKindBlock;
}

function getLineCount(
	block: PreparedBlock,
	maxWidth: number,
): number {
	if (maxWidth <= 1) return 1;
	return Math.max(1, measureLineStats(block.prepared, maxWidth).lineCount);
}

function clampWidth(width: number): number {
	return Math.max(
		tableNodeMetrics.minWidth,
		Math.min(tableNodeMetrics.maxWidth, Math.ceil(width)),
	);
}

function getStatsWidth(table: TableData): number {
	const segments = [
		`${table.columns.length}cols`,
		`${table.columns.filter((column) => column.pk).length}pk`,
		`${table.columns.filter((column) => column.isForeignKey).length}fk`,
		`${table.indexes.filter((index) => index.kind !== "primary").length}idx`,
	];
	let width = tableNodeMetrics.stats.padX * 2;
	for (let index = 0; index < segments.length; index++) {
		width += prepareBlock(
			segments[index]!,
			tableNodeMetrics.stats.text.font,
		).naturalWidth;
		if (index < segments.length - 1) width += tableNodeMetrics.stats.gap;
	}
	return width;
}

function getPreferredWidth(
	table: TableData,
	rows: ReadonlyArray<{ name: PreparedBlock; type: PreparedBlock }>,
	note: PreparedBlock | null,
	title: PreparedBlock,
	schema: PreparedBlock | null,
	naturalTypeWidth: number,
): number {
	const headerTextWidth = Math.max(
		title.naturalWidth,
		schema?.naturalWidth ?? 0,
	);
	const kind = getKindBlock();
	const headerWidth =
		tableNodeMetrics.nodeBorder * 2 +
		tableNodeMetrics.header.padX * 2 +
		tableNodeMetrics.header.glyphSize +
		tableNodeMetrics.header.gap +
		headerTextWidth +
		tableNodeMetrics.header.kindGap +
		kind.naturalWidth;

	const noteWidth =
		note === null
			? 0
			: tableNodeMetrics.nodeBorder * 2 +
				tableNodeMetrics.note.padX * 2 +
				Math.min(note.naturalWidth, tableNodeMetrics.maxWidth);

	const sharedTypeWidth = Math.max(
		tableNodeMetrics.row.minTypeColumnWidth,
		Math.min(tableNodeMetrics.row.maxTypeColumnWidth, naturalTypeWidth),
	);
	const rowWidth = rows.reduce((widest, row) => {
		const natural =
			tableNodeMetrics.nodeBorder * 2 +
			tableNodeMetrics.row.padX * 2 +
			tableNodeMetrics.row.glyphWidth +
			tableNodeMetrics.row.gap * 2 +
			Math.ceil(row.name.naturalWidth) +
			sharedTypeWidth;
		return Math.max(widest, natural);
	}, 0);

	return clampWidth(
		Math.max(
			tableNodeMetrics.minWidth,
			headerWidth,
			tableNodeMetrics.nodeBorder * 2 + getStatsWidth(table),
			noteWidth,
			rowWidth,
		),
	);
}

function buildCachedLayout(table: TableData): CachedTableLayout {
	const title = prepareBlock(table.name, tableNodeMetrics.header.title.font);
	const schema = table.schema
		? prepareBlock(table.schema, tableNodeMetrics.header.schema.font)
		: null;
	const note = table.note
		? prepareBlock(table.note, tableNodeMetrics.note.text.font, {
				whiteSpace: "pre-wrap",
			})
		: null;
	const rows = table.columns.map((column) => ({
		columnName: column.name,
		name: prepareBlock(column.name, tableNodeMetrics.row.name.font),
		type: prepareBlock(column.type, tableNodeMetrics.row.type.font),
	}));
	const naturalTypeWidth = rows.reduce(
		(widest, row) => Math.max(widest, Math.ceil(row.type.naturalWidth)),
		0,
	);

	const width = getPreferredWidth(table, rows, note, title, schema, naturalTypeWidth);
	const innerWidth = width - tableNodeMetrics.nodeBorder * 2;
	const kind = getKindBlock();
	const headerTextWidth = Math.max(
		1,
		innerWidth -
			tableNodeMetrics.header.padX * 2 -
			tableNodeMetrics.header.glyphSize -
			tableNodeMetrics.header.gap -
			tableNodeMetrics.header.kindGap -
			Math.ceil(kind.naturalWidth),
	);
	const headerHeight =
		tableNodeMetrics.header.padY * 2 +
		getLineCount(title, headerTextWidth) *
			tableNodeMetrics.header.title.lineHeight +
		(schema === null
			? 0
			: tableNodeMetrics.header.textGap +
				getLineCount(schema, headerTextWidth) *
					tableNodeMetrics.header.schema.lineHeight) +
		tableNodeMetrics.sectionBorder;

	const statsHeight =
		tableNodeMetrics.stats.padY * 2 +
		tableNodeMetrics.stats.text.lineHeight +
		tableNodeMetrics.sectionBorder;
	const noteHeight =
		note === null
			? 0
			: tableNodeMetrics.note.padY * 2 +
				getLineCount(note, innerWidth - tableNodeMetrics.note.padX * 2) *
					tableNodeMetrics.note.text.lineHeight +
				tableNodeMetrics.sectionBorder;

	const rowTextWidth =
		innerWidth -
		tableNodeMetrics.row.padX * 2 -
		tableNodeMetrics.row.glyphWidth -
		tableNodeMetrics.row.gap * 2;
	const maxTypeWidth = Math.max(
		tableNodeMetrics.row.minTypeColumnWidth,
		rowTextWidth - tableNodeMetrics.row.minNameColumnWidth,
	);
	const typeColumnWidth = Math.max(
		tableNodeMetrics.row.minTypeColumnWidth,
		Math.min(tableNodeMetrics.row.maxTypeColumnWidth, maxTypeWidth, naturalTypeWidth),
	);
	const nameColumnWidth = Math.max(1, rowTextWidth - typeColumnWidth);

	const rowBoundsByColumn = new Map<string, RowBounds>();
	let bodyHeight = 0;
	for (let index = 0; index < rows.length; index++) {
		const row = rows[index]!;
		const nameHeight =
			getLineCount(row.name, nameColumnWidth) *
			tableNodeMetrics.row.name.lineHeight;
		const typeHeight =
			getLineCount(row.type, typeColumnWidth) *
			tableNodeMetrics.row.type.lineHeight;
		const rowHeight =
			tableNodeMetrics.row.padY * 2 +
			Math.max(tableNodeMetrics.row.glyphHeight, nameHeight, typeHeight);
		rowBoundsByColumn.set(row.columnName, {
			top: headerHeight + statsHeight + noteHeight + bodyHeight,
			bottom: headerHeight + statsHeight + noteHeight + bodyHeight + rowHeight,
		});
		bodyHeight += rowHeight;
		if (index < rows.length - 1) bodyHeight += tableNodeMetrics.sectionBorder;
	}

	return {
		height:
			tableNodeMetrics.nodeBorder * 2 +
			headerHeight +
			statsHeight +
			noteHeight +
			bodyHeight,
		rowBoundsByColumn,
		typeColumnWidth,
		width,
	};
}

function getCachedLayout(table: TableData): CachedTableLayout {
	const cached = cachedLayouts.get(table);
	if (cached) return cached;

	const next = buildCachedLayout(table);
	cachedLayouts.set(table, next);
	return next;
}

export function clearTableNodeLayoutCache(): void {
	cachedLayouts = new WeakMap<TableData, CachedTableLayout>();
	cachedKindBlock = null;
}

export function getCompositeHandleOffsets(
	table: TableData,
	relationAnchors: readonly RelationAnchorData[],
): Readonly<Record<string, number>> {
	if (relationAnchors.length === 0) return {};

	const layout = getCachedLayout(table);
	return Object.fromEntries(
		relationAnchors.flatMap((anchor) => {
			if (anchor.columns.length <= 1) return [];

			let minTop = Number.POSITIVE_INFINITY;
			let maxBottom = Number.NEGATIVE_INFINITY;
			for (const columnName of anchor.columns) {
				const bounds = layout.rowBoundsByColumn.get(columnName);
				if (!bounds) continue;
				if (bounds.top < minTop) minTop = bounds.top;
				if (bounds.bottom > maxBottom) maxBottom = bounds.bottom;
			}

			if (minTop === Number.POSITIVE_INFINITY) return [];
			return [[anchor.id, (minTop + maxBottom) / 2] as const];
		}),
	);
}

export function getTableNodeLayout(table: TableData): TableNodeLayout {
	const layout = getCachedLayout(table);
	return {
		height: layout.height,
		typeColumnWidth: layout.typeColumnWidth,
		width: layout.width,
	};
}
