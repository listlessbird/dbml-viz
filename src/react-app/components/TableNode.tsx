import {
	type CSSProperties,
	memo,
	useEffectEvent,
	useEffect,
	useRef,
} from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

import { ColumnConstraintBadges } from "@/components/table-node/ColumnConstraintBadges";
import { ColumnStatusIcon } from "@/components/table-node/ColumnStatusIcon";
import { CompositeRelationHandles } from "@/components/table-node/CompositeRelationHandles";
import { getSourceHandleId, getTargetHandleId } from "@/lib/relation-handles";
import { getColumnConstraintBadges } from "@/lib/table-constraints";
import { cn } from "@/lib/utils";
import type { ColumnData, DiagramNode, TableNodeData } from "@/types";

const COLUMN_HANDLE_CLASS_NAME =
	"!size-2.5 !border-0 !bg-primary !shadow-none transition-opacity";

type SchemaTableNodeStyle = CSSProperties &
	Record<
		"--schema-accent" | "--schema-node-opacity" | "--schema-surface-shadow",
		string | number
	>;

const getSurfaceShadow = (data: TableNodeData, selected: boolean) => {
	if (selected || data.isSearchMatch) {
		return `0 0 0 1px ${data.accent}, 0 0 0 3px color-mix(in oklab, ${data.accent} 14%, transparent), 0 16px 34px color-mix(in oklab, var(--foreground) 14%, transparent)`;
	}

	if (data.isRelationContextActive) {
		return "0 0 0 1px color-mix(in oklab, var(--primary) 18%, var(--border)), 0 16px 30px color-mix(in oklab, var(--primary) 10%, transparent)";
	}

	if (data.isSearchRelated) {
		return "0 0 0 1px color-mix(in oklab, var(--primary) 24%, var(--border)), 0 14px 28px color-mix(in oklab, var(--foreground) 12%, transparent)";
	}

	return "0 0 0 1px color-mix(in oklab, var(--foreground) 8%, transparent), 0 10px 24px color-mix(in oklab, var(--foreground) 10%, transparent)";
};

const getColumnMetaLabel = (column: ColumnData) =>
	[
		column.notNull ? "NOT NULL" : "NULLABLE",
		column.unique ? "UNIQUE" : null,
		column.isIndexed && !column.pk && !column.unique ? "INDEXED" : null,
	]
		.filter(Boolean)
		.join(" · ");

export const TableNode = memo(function TableNode({
	id,
	data,
	selected,
}: NodeProps<DiagramNode>) {
	const containerRef = useRef<HTMLDivElement | null>(null);

	const connectedColumns = new Set(data.connectedColumns);
	const activeRelationColumns = new Set(data.activeRelationColumns ?? []);
	const constraintBadgesByColumn = getColumnConstraintBadges(data.table);
	const nodeStyle: SchemaTableNodeStyle = {
		"--schema-accent": data.accent,
		"--schema-node-opacity": data.isSearchDimmed ? 0.32 : 1,
		"--schema-surface-shadow": getSurfaceShadow(data, selected),
	};

	const reportMeasurement = useEffectEvent((width: number, height: number) => {
		if (!data.onMeasure) {
			return;
		}

		data.onMeasure(id, {
			width: Math.round(width),
			height: Math.round(height),
		});
	});

	useEffect(() => {
		const element = containerRef.current;
		if (!element || !data.onMeasure) {
			return;
		}

		const initialFrameId = window.requestAnimationFrame(() => {
			const { width, height } = element.getBoundingClientRect();
			reportMeasurement(width, height);
		});
		const observer = new ResizeObserver((entries) => {
			const entry = entries[entries.length - 1];
			if (!entry) {
				return;
			}

			reportMeasurement(entry.contentRect.width, entry.contentRect.height);
		});

		observer.observe(element);

		return () => {
			window.cancelAnimationFrame(initialFrameId);
			observer.disconnect();
		};
	}, [data.onMeasure, id]);

	return (
		<div
			ref={containerRef}
			className="schema-table-node relative w-fit min-w-[260px] max-w-[420px] overflow-hidden border border-border bg-card text-card-foreground hover:cursor-move"
			style={nodeStyle}
		>
			<div className="schema-table-accent-rail pointer-events-none absolute inset-x-0 top-0 h-px" />
			<CompositeRelationHandles
				activeColumns={activeRelationColumns}
				connectedColumns={connectedColumns}
				relationAnchors={data.relationAnchors}
				topOffsets={data.compositeHandleOffsets}
			/>

			<div className="schema-table-header border-b px-3 py-2">
				<div className="flex items-center justify-between gap-2">
					<h3 className="schema-table-heading truncate text-[0.8rem] font-semibold tracking-tight">
						{data.table.name}
					</h3>
					<span className="schema-table-count shrink-0 border px-1.5 py-0.5 text-[0.6rem] uppercase tracking-[0.12em]">
						{data.table.columns.length}
					</span>
				</div>
				{data.table.note ? (
					<p className="mt-1 truncate text-[0.65rem] text-muted-foreground">
						{data.table.note}
					</p>
				) : null}
			</div>

			<div className="divide-y divide-border">
				{data.table.columns.map((column) => {
					const isConnected = connectedColumns.has(column.name);
					const isRelationActiveColumn = activeRelationColumns.has(column.name);
					const constraintBadges = constraintBadgesByColumn.get(column.name) ?? [];

					return (
						<div
							key={column.name}
							className={cn(
								"schema-column-row group/row relative flex min-h-8 items-center gap-2 px-3 py-1.5",
								isRelationActiveColumn && "schema-column-row--active",
							)}
						>
							<Handle
								id={getTargetHandleId(data.table.id, column.name)}
								type="target"
								position={Position.Left}
								isConnectable={false}
								className={cn(
									COLUMN_HANDLE_CLASS_NAME,
									isConnected || isRelationActiveColumn
										? "!opacity-100"
										: "!opacity-0 group-hover/row:!opacity-60",
								)}
								style={{ left: -6, top: "50%", transform: "translateY(-50%)" }}
							/>
							<Handle
								id={getSourceHandleId(data.table.id, column.name)}
								type="source"
								position={Position.Right}
								isConnectable={false}
								className={cn(
									COLUMN_HANDLE_CLASS_NAME,
									isConnected || isRelationActiveColumn
										? "!opacity-100"
										: "!opacity-0 group-hover/row:!opacity-60",
								)}
								style={{ right: -6, top: "50%", transform: "translateY(-50%)" }}
							/>

							<div className="flex w-4 shrink-0 justify-center text-primary transition-colors duration-200 ease-out">
								<ColumnStatusIcon
									isForeignKey={column.isForeignKey}
									isPrimaryKey={column.pk}
									isRelationActive={isRelationActiveColumn}
								/>
							</div>

							<div className="min-w-0 flex-1">
								<p
									className={cn(
										"truncate text-xs font-medium transition-colors duration-200 ease-out",
										isRelationActiveColumn ? "text-foreground" : "text-card-foreground",
									)}
								>
									{column.name}
								</p>
								<ColumnConstraintBadges
									badges={constraintBadges}
									isActive={isRelationActiveColumn}
								/>
								{column.note ? (
									<p
										className={cn(
											"truncate text-[0.65rem] transition-colors duration-200 ease-out",
											constraintBadges.length > 0 ? "mt-1" : "",
											isRelationActiveColumn
												? "text-foreground/70"
												: "text-muted-foreground",
										)}
									>
										{column.note}
									</p>
								) : null}
							</div>

							<div
								className={cn(
									"flex flex-col items-end gap-0.5 text-[0.65rem] transition-colors duration-200 ease-out",
									isRelationActiveColumn ? "text-foreground/70" : "text-muted-foreground",
								)}
							>
								<span
									className={cn(
										"schema-column-type max-w-[13rem] border px-1.5 py-0.5 text-right font-medium whitespace-normal break-words transition-colors duration-200 ease-out",
										isRelationActiveColumn && "schema-column-type--active",
										isRelationActiveColumn ? "text-foreground" : "text-card-foreground",
									)}
								>
									{column.type}
								</span>
								<span
									className={cn(
										"schema-column-meta text-[0.55rem] uppercase transition-colors duration-200 ease-out",
										isRelationActiveColumn
											? "text-foreground/70"
											: "text-muted-foreground",
									)}
								>
									{getColumnMetaLabel(column)}
								</span>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
});
