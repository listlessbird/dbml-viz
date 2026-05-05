import { IconCornerDownLeft } from "@tabler/icons-react";
import { memo } from "react";

import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { MentionItem } from "@/components/ui/mention";
import { cn } from "@/lib/utils";
import type { ColumnData, TableData } from "@/types";

export const LinkerMentionList = memo(function LinkerMentionList({
	tables,
}: {
	readonly tables: readonly TableData[];
}) {
	return (
		<div className="flex flex-col">
			<div className="max-h-[300px] overflow-y-auto p-1">
				{tables.map((table) => (
					<TableRow key={table.id} table={table} />
				))}
				{tables.flatMap((table) =>
					table.columns.map((column) => (
						<ColumnRow
							key={`${table.id}-${column.name}`}
							table={table}
							column={column}
						/>
					))
				)}
			</div>
			<div className="flex items-center justify-between gap-2 border-t border-border bg-muted/40 px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
				<KbdGroup>
					<Kbd>↑↓</Kbd>
					<span>navigate</span>
					<Kbd>
						<IconCornerDownLeft />
					</Kbd>
					<span>insert</span>
				</KbdGroup>
				<Kbd>Esc</Kbd>
			</div>
		</div>
	);
});

function TableRow({
	table,
}: {
	readonly table: TableData;
}) {
	return (
		<MentionItem value={table.name}>
			<span
				className={cn(
					"relative inline-block size-3 shrink-0 rounded-xs border bg-background border-[#1e3a8a]",
				)}
				aria-hidden
			>
				<span
					className="absolute -right-px -bottom-px size-1 border-t border-l border-[#1e3a8a] bg-background"
					aria-hidden
				/>
			</span>
			<span className="min-w-0 break-all font-mono text-xs text-foreground">
				{table.name}
			</span>
			<span className="ml-auto shrink-0 text-[9px] font-bold tracking-widest text-muted-foreground uppercase">
				{table.columns.length} cols
			</span>
		</MentionItem>
	);
}

function ColumnRow({
	table,
	column,
}: {
	readonly table: TableData;
	readonly column: ColumnData;
}) {
	return (
		<MentionItem value={`${table.name}.${column.name}`}>
			<span
				className="relative inline-block size-3 shrink-0 rounded-xs border border-[#a78bfa] bg-background"
				aria-hidden
			>
				<span
					className="absolute inset-[2px_2px_5px_2px] bg-[#a78bfa]"
					aria-hidden
				/>
			</span>
			<span className="min-w-0 break-all font-mono text-xs text-foreground">
				{table.name}.{column.name}
			</span>
			<span className="ml-auto shrink-0 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
				{column.type}
			</span>
		</MentionItem>
	);
}
