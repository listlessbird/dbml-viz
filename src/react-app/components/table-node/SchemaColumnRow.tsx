import { Handle, Position } from "@xyflow/react";

import { getSourceHandleId, getTargetHandleId } from "@/lib/relation-handles";
import type { ColumnConstraintBadge } from "@/lib/table-constraints";
import { cn } from "@/lib/utils";
import type { ColumnData } from "@/types";

const HANDLE_CLASS =
	"!size-2.5 !border-0 !bg-primary !shadow-none transition-opacity";

const statusGlyph = (column: ColumnData) => {
	if (column.pk) return { char: "⚿", cls: "schema-column-key--pk" };
	if (column.isForeignKey) return { char: "→", cls: "schema-column-key--fk" };
	return { char: "·", cls: "schema-column-key--plain" };
};

const buildRowTooltip = (
	column: ColumnData,
	badges: readonly ColumnConstraintBadge[],
) => {
	const role = column.pk
		? "PRIMARY KEY"
		: column.isForeignKey
			? "FOREIGN KEY"
			: null;
	const lines: string[] = [`${column.name} ${column.type}`];
	if (role) lines.push(role);
	const flags = [
		column.notNull ? "NOT NULL" : "NULLABLE",
		column.unique ? "UNIQUE" : null,
		column.isIndexed && !column.pk && !column.unique ? "INDEXED" : null,
	].filter(Boolean);
	if (flags.length > 0) lines.push(flags.join(" · "));
	for (const b of badges) lines.push(b.title);
	if (column.note) lines.push(column.note);
	return lines.join("\n");
};

interface SchemaColumnRowProps {
	readonly tableId: string;
	readonly column: ColumnData;
	readonly isConnected: boolean;
	readonly isActive: boolean;
	readonly badges: readonly ColumnConstraintBadge[];
}

export function SchemaColumnRow({
	tableId,
	column,
	isConnected,
	isActive,
	badges,
}: SchemaColumnRowProps) {
	const glyph = statusGlyph(column);
	const handleVisibility =
		isConnected || isActive
			? "!opacity-100"
			: "!opacity-0 group-hover/row:!opacity-60";

	return (
		<div
			className={cn(
				"schema-column-row group/row relative grid grid-cols-[16px_1fr_auto] items-center gap-2 px-2.5 py-1.5 min-h-[26px]",
				isActive && "schema-column-row--active",
			)}
			title={buildRowTooltip(column, badges)}
		>
			<Handle
				id={getTargetHandleId(tableId, column.name)}
				type="target"
				position={Position.Left}
				isConnectable={false}
				className={cn(HANDLE_CLASS, handleVisibility)}
				style={{ left: -6, top: "50%", transform: "translateY(-50%)" }}
			/>
			<Handle
				id={getSourceHandleId(tableId, column.name)}
				type="source"
				position={Position.Right}
				isConnectable={false}
				className={cn(HANDLE_CLASS, handleVisibility)}
				style={{ right: -6, top: "50%", transform: "translateY(-50%)" }}
			/>

			<span
				className={cn(
					"schema-column-key text-center text-[10px] leading-none",
					glyph.cls,
				)}
				aria-hidden="true"
			>
				{glyph.char}
			</span>

			<span className="schema-column-name truncate font-mono text-[12px] text-foreground">
				{column.name}
			</span>

			<span className="schema-column-type font-mono text-[11px] text-muted-foreground text-right">
				{column.type}
			</span>
		</div>
	);
}
