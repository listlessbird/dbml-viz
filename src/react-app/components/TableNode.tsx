import { type CSSProperties, memo, useMemo } from "react";
import { type NodeProps } from "@xyflow/react";

import { CompositeRelationHandles } from "@/components/table-node/CompositeRelationHandles";
import {
	tableNodeMetrics,
	tableNodeStyles,
} from "@/components/table-node/metrics";
import { TableKindGlyph } from "@/components/table-node/TableKindGlyph";
import { SchemaColumnRow } from "@/components/table-node/SchemaColumnRow";
import { formatIndexSummary } from "@/lib/schema-format";
import { getColumnConstraintBadges } from "@/lib/table-constraints";
import type {
	DiagramNode,
	RelationAnchorData,
	TableData,
	TableNodeData,
} from "@/types";

const areStringArraysEqual = (
	a: readonly string[] | undefined,
	b: readonly string[] | undefined,
) => {
	if (a === b) return true;
	if (!a || !b) return false;
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
};

const areRelationAnchorsEqual = (
	a: readonly RelationAnchorData[],
	b: readonly RelationAnchorData[],
) => {
	if (a === b) return true;
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		const prev = a[i];
		const next = b[i];
		if (prev.id !== next.id || prev.side !== next.side) return false;
		if (!areStringArraysEqual(prev.columns, next.columns)) return false;
	}
	return true;
};

const areNumberRecordsEqual = (
	a: Readonly<Record<string, number>>,
	b: Readonly<Record<string, number>>,
) => {
	if (a === b) return true;
	const keys = Object.keys(a);
	if (keys.length !== Object.keys(b).length) return false;
	for (const key of keys) {
		if (a[key] !== b[key]) return false;
	}
	return true;
};

const areTableLayoutsEqual = (
	a: TableNodeData["layout"],
	b: TableNodeData["layout"],
) =>
	a.width === b.width &&
	a.height === b.height &&
	a.typeColumnWidth === b.typeColumnWidth;

const areTableNodePropsEqual = (
	prev: NodeProps<DiagramNode>,
	next: NodeProps<DiagramNode>,
) => {
	if (prev.id !== next.id || prev.selected !== next.selected) return false;
	const a = prev.data;
	const b = next.data;
	return (
		a.table === b.table &&
		a.accent === b.accent &&
		a.isSearchMatch === b.isSearchMatch &&
		a.isSearchRelated === b.isSearchRelated &&
		a.isSearchDimmed === b.isSearchDimmed &&
		a.isRelationContextActive === b.isRelationContextActive &&
		areTableLayoutsEqual(a.layout, b.layout) &&
		areStringArraysEqual(a.connectedColumns, b.connectedColumns) &&
		areStringArraysEqual(a.activeRelationColumns, b.activeRelationColumns) &&
		areRelationAnchorsEqual(a.relationAnchors, b.relationAnchors) &&
		areNumberRecordsEqual(a.compositeHandleOffsets, b.compositeHandleOffsets)
	);
};

type SchemaTableNodeStyle = CSSProperties &
	Record<"--schema-node-opacity" | "--schema-surface-shadow", string | number>;

const getSurfaceShadow = (data: TableNodeData, selected: boolean) => {
	if (selected || data.isSearchMatch) {
		return "0 0 0 1px var(--primary), 0 0 0 3px color-mix(in oklab, var(--primary) 14%, transparent), 0 16px 34px color-mix(in oklab, var(--foreground) 14%, transparent)";
	}
	if (data.isRelationContextActive) {
		return "0 0 0 1px color-mix(in oklab, var(--primary) 18%, var(--border)), 0 16px 30px color-mix(in oklab, var(--primary) 10%, transparent)";
	}
	if (data.isSearchRelated) {
		return "0 0 0 1px color-mix(in oklab, var(--primary) 24%, var(--border)), 0 14px 28px color-mix(in oklab, var(--foreground) 12%, transparent)";
	}
	return "0 0 0 1px color-mix(in oklab, var(--foreground) 8%, transparent), 0 10px 24px color-mix(in oklab, var(--foreground) 10%, transparent)";
};

interface TableStats {
	readonly colNames: readonly string[];
	readonly pkNames: readonly string[];
	readonly fkNames: readonly string[];
	readonly idxSummaries: readonly string[];
}

interface TableNodeViewModel {
	readonly activeRelationColumns: ReadonlySet<string>;
	readonly connectedColumns: ReadonlySet<string>;
	readonly constraintBadgesByColumn: ReturnType<typeof getColumnConstraintBadges>;
	readonly stats: TableStats;
	readonly statsTooltips: Record<
		"columns" | "foreignKeys" | "indexes" | "primaryKeys",
		string
	>;
}

const getTableStats = (table: TableData): TableStats => {
	const pkNames: string[] = [];
	const fkNames: string[] = [];
	for (const c of table.columns) {
		if (c.pk) pkNames.push(c.name);
		if (c.isForeignKey) fkNames.push(c.name);
	}
	const idxSummaries = table.indexes
		.filter((i) => i.kind !== "primary")
		.map(formatIndexSummary);
	return {
		colNames: table.columns.map((c) => c.name),
		pkNames,
		fkNames,
		idxSummaries,
	};
};

const plural = (n: number, one: string, many: string) =>
	`${n} ${n === 1 ? one : many}`;

const buildTooltip = (
	count: number,
	one: string,
	many: string,
	items: readonly string[],
	separator = ", ",
) => {
	if (count === 0) return `No ${many}`;
	return `${plural(count, one, many)}: ${items.join(separator)}`;
};

const getTableNodeViewModel = (
	table: TableData,
	connectedColumnNames: readonly string[],
	activeRelationColumnNames: readonly string[] | undefined,
): TableNodeViewModel => {
	const stats = getTableStats(table);
	return {
		activeRelationColumns: new Set(activeRelationColumnNames ?? []),
		connectedColumns: new Set(connectedColumnNames),
		constraintBadgesByColumn: getColumnConstraintBadges(table),
		stats,
		statsTooltips: {
			columns: buildTooltip(
				stats.colNames.length,
				"column",
				"columns",
				stats.colNames,
			),
			foreignKeys: buildTooltip(
				stats.fkNames.length,
				"foreign-key column",
				"foreign-key columns",
				stats.fkNames,
			),
			indexes: buildTooltip(
				stats.idxSummaries.length,
				"non-primary index",
				"non-primary indexes",
				stats.idxSummaries,
				"\n",
			),
			primaryKeys: buildTooltip(
				stats.pkNames.length,
				"primary-key column",
				"primary-key columns",
				stats.pkNames,
			),
		},
	};
};

export const TableNode = memo(function TableNode({
	id,
	data,
	selected,
}: NodeProps<DiagramNode>) {
	const viewModel = useMemo(() => getTableNodeViewModel(
		data.table,
		data.connectedColumns,
		data.activeRelationColumns,
	), [data.activeRelationColumns, data.connectedColumns, data.table]);

	const nodeStyle: SchemaTableNodeStyle = {
		"--schema-node-opacity": data.isSearchDimmed ? 0.32 : 1,
		"--schema-surface-shadow": getSurfaceShadow(data, selected),
		borderWidth: tableNodeMetrics.nodeBorder,
		width: `${data.layout.width}px`,
	};

	return (
		<div
			data-node-id={id}
			className="schema-table-node relative overflow-hidden border border-border bg-card text-card-foreground hover:cursor-move"
			style={nodeStyle}
		>
			<CompositeRelationHandles
				activeColumns={viewModel.activeRelationColumns}
				connectedColumns={viewModel.connectedColumns}
				relationAnchors={data.relationAnchors}
				topOffsets={data.compositeHandleOffsets}
			/>

			<div
				className="schema-table-header flex items-start"
				style={tableNodeStyles.header}
			>
				<TableKindGlyph />
				<div className="min-w-0 flex-1">
					<h3
						className="schema-table-heading [overflow-wrap:anywhere]"
						style={tableNodeStyles.headerTitle}
					>
						{data.table.name}
					</h3>
					{data.table.schema ? (
						<p
							className="schema-table-schema [overflow-wrap:anywhere]"
							style={tableNodeStyles.headerSchema}
						>
							{data.table.schema}
						</p>
					) : null}
				</div>
				<span
					className="schema-table-kind shrink-0 uppercase"
					style={tableNodeStyles.headerKind}
				>
					TABLE
				</span>
			</div>

			<div
				className="schema-table-stats flex items-center border-b text-muted-foreground"
				style={tableNodeStyles.stats}
			>
				<span title={viewModel.statsTooltips.columns}>
					<b className="schema-table-stat-value">
						{viewModel.stats.colNames.length}
					</b>
					cols
				</span>
				<span title={viewModel.statsTooltips.primaryKeys}>
					<b className="schema-table-stat-value">
						{viewModel.stats.pkNames.length}
					</b>
					pk
				</span>
				<span title={viewModel.statsTooltips.foreignKeys}>
					<b className="schema-table-stat-value">
						{viewModel.stats.fkNames.length}
					</b>
					fk
				</span>
				<span title={viewModel.statsTooltips.indexes}>
					<b className="schema-table-stat-value">
						{viewModel.stats.idxSummaries.length}
					</b>
					idx
				</span>
			</div>

			{data.table.note ? (
				<p
					className="border-b whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]"
					style={tableNodeStyles.note}
				>
					{data.table.note}
				</p>
			) : null}

			<div>
				{data.table.columns.map((column, index) => (
					<SchemaColumnRow
						key={column.name}
						tableId={data.table.id}
						typeColumnWidth={data.layout.typeColumnWidth}
						column={column}
						isConnected={viewModel.connectedColumns.has(column.name)}
						isActive={viewModel.activeRelationColumns.has(column.name)}
						showDivider={index > 0}
						badges={viewModel.constraintBadgesByColumn.get(column.name) ?? []}
					/>
				))}
			</div>
		</div>
	);
}, areTableNodePropsEqual);
