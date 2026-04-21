import {
	type CSSProperties,
	memo,
	useEffectEvent,
	useEffect,
	useMemo,
	useRef,
} from "react";
import { type NodeProps } from "@xyflow/react";

import { CompositeRelationHandles } from "@/components/table-node/CompositeRelationHandles";
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
		a.onMeasure === b.onMeasure &&
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

export const TableNode = memo(function TableNode({
	id,
	data,
	selected,
}: NodeProps<DiagramNode>) {
	const containerRef = useRef<HTMLDivElement | null>(null);

	const connectedColumns = new Set(data.connectedColumns);
	const activeRelationColumns = new Set(data.activeRelationColumns ?? []);
	const constraintBadgesByColumn = getColumnConstraintBadges(data.table);
	const stats = useMemo(() => getTableStats(data.table), [data.table]);

	const nodeStyle: SchemaTableNodeStyle = {
		"--schema-node-opacity": data.isSearchDimmed ? 0.32 : 1,
		"--schema-surface-shadow": getSurfaceShadow(data, selected),
	};

	const reportMeasurement = useEffectEvent((width: number, height: number) => {
		if (!data.onMeasure) return;
		data.onMeasure(id, {
			width: Math.round(width),
			height: Math.round(height),
		});
	});

	useEffect(() => {
		const element = containerRef.current;
		if (!element || !data.onMeasure) return;

		const observer = new ResizeObserver((entries) => {
			const entry = entries[entries.length - 1];
			if (entry) {
				reportMeasurement(entry.contentRect.width, entry.contentRect.height);
			}
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [data.onMeasure, id]);

	return (
		<div
			ref={containerRef}
			className="schema-table-node relative w-fit min-w-[260px] max-w-[420px] overflow-hidden border border-border bg-card text-card-foreground hover:cursor-move"
			style={nodeStyle}
		>
			<CompositeRelationHandles
				activeColumns={activeRelationColumns}
				connectedColumns={connectedColumns}
				relationAnchors={data.relationAnchors}
				topOffsets={data.compositeHandleOffsets}
			/>

			<div className="schema-table-header flex items-center gap-2 px-2.5 py-2">
				<TableKindGlyph />
				<h3 className="schema-table-heading truncate text-[13px] font-semibold">
					{data.table.name}
				</h3>
				{data.table.schema ? (
					<span className="schema-table-schema ml-1 truncate text-[11px] font-normal">
						{data.table.schema}
					</span>
				) : null}
				<span className="schema-table-kind ml-auto shrink-0 text-[9px] font-semibold uppercase tracking-[0.14em]">
					TABLE
				</span>
			</div>

			<div className="schema-table-stats flex items-center gap-3.5 border-b px-2.5 py-[5px] font-mono text-[10px] tabular-nums text-muted-foreground">
				<span
					title={buildTooltip(
						stats.colNames.length,
						"column",
						"columns",
						stats.colNames,
					)}
				>
					<b className="schema-table-stat-value">{stats.colNames.length}</b>cols
				</span>
				<span
					title={buildTooltip(
						stats.pkNames.length,
						"primary-key column",
						"primary-key columns",
						stats.pkNames,
					)}
				>
					<b className="schema-table-stat-value">{stats.pkNames.length}</b>pk
				</span>
				<span
					title={buildTooltip(
						stats.fkNames.length,
						"foreign-key column",
						"foreign-key columns",
						stats.fkNames,
					)}
				>
					<b className="schema-table-stat-value">{stats.fkNames.length}</b>fk
				</span>
				<span
					title={buildTooltip(
						stats.idxSummaries.length,
						"non-primary index",
						"non-primary indexes",
						stats.idxSummaries,
						"\n",
					)}
				>
					<b className="schema-table-stat-value">{stats.idxSummaries.length}</b>idx
				</span>
			</div>

			{data.table.note ? (
				<p className="truncate border-b px-3 py-1.5 text-[0.65rem] text-muted-foreground">
					{data.table.note}
				</p>
			) : null}

			<div className="divide-y divide-border">
				{data.table.columns.map((column) => (
					<SchemaColumnRow
						key={column.name}
						tableId={data.table.id}
						column={column}
						isConnected={connectedColumns.has(column.name)}
						isActive={activeRelationColumns.has(column.name)}
						badges={constraintBadgesByColumn.get(column.name) ?? []}
					/>
				))}
			</div>
		</div>
	);
}, areTableNodePropsEqual);
