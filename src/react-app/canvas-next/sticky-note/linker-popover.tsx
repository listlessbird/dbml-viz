import { IconCornerDownLeft } from "@tabler/icons-react";
import { memo, useMemo, useState } from "react";

import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ColumnData, TableData } from "@/types";

import type { LinkerStage } from "@/canvas-next/sticky-note/use-sticky-linker";

interface LinkerPopoverProps {
	readonly tables: readonly TableData[];
	readonly stage: LinkerStage;
	readonly scopedTable: TableData | null;
	readonly onPickTable: (table: TableData) => void;
	readonly onPickColumn: (table: TableData, column: ColumnData) => void;
	readonly onBackToTables: () => void;
	readonly onClose: () => void;
}

export const LinkerPopoverContent = memo(function LinkerPopoverContent({
	tables,
	stage,
	scopedTable,
	onPickTable,
	onPickColumn,
	onBackToTables,
	onClose,
}: LinkerPopoverProps) {
	const [query, setQuery] = useState("");

	return (
		<PopoverContent
			align="start"
			side="bottom"
			sideOffset={6}
			className="w-60 gap-0 border border-border bg-popover p-0 font-sans shadow-lg"
		>
			<Command
				loop
				onKeyDown={(event) => {
					if (event.key === "Escape") {
						event.preventDefault();
						onClose();
						return;
					}
					if (
						stage === "columns" &&
						event.key === "Backspace" &&
						query.length === 0
					) {
						event.preventDefault();
						setQuery("");
						onBackToTables();
					}
				}}
			>
				{stage === "tables" ? (
					<TablesPanel
						tables={tables}
						query={query}
						onQueryChange={setQuery}
						onPick={(table) => {
							setQuery("");
							onPickTable(table);
						}}
					/>
				) : scopedTable ? (
					<ColumnsPanel
						table={scopedTable}
						query={query}
						onQueryChange={setQuery}
						onPick={(column) => {
							setQuery("");
							onPickColumn(scopedTable, column);
						}}
					/>
				) : null}
				<LinkerFoot stage={stage} />
			</Command>
		</PopoverContent>
	);
});

interface TablesPanelProps {
	readonly tables: readonly TableData[];
	readonly query: string;
	readonly onQueryChange: (value: string) => void;
	readonly onPick: (table: TableData) => void;
}

function TablesPanel({
	tables,
	query,
	onQueryChange,
	onPick,
}: TablesPanelProps) {
	const ordered = useMemo(() => tables.slice(), [tables]);
	return (
		<>
			<CommandInput
				placeholder="type to filter…"
				value={query}
				onValueChange={onQueryChange}
			/>
			<CommandList>
				<CommandEmpty>No matches.</CommandEmpty>
				<CommandGroup heading="Tables on canvas">
					{ordered.map((table) => (
						<TableRow
							key={table.id}
							table={table}
							onSelect={() => onPick(table)}
						/>
					))}
				</CommandGroup>
			</CommandList>
		</>
	);
}

interface ColumnsPanelProps {
	readonly table: TableData;
	readonly query: string;
	readonly onQueryChange: (value: string) => void;
	readonly onPick: (column: ColumnData) => void;
}

function ColumnsPanel({
	table,
	query,
	onQueryChange,
	onPick,
}: ColumnsPanelProps) {
	return (
		<>
			<CommandInput
				placeholder={`${table.name}.`}
				value={query}
				onValueChange={onQueryChange}
			/>
			<CommandList>
				<CommandEmpty>No columns.</CommandEmpty>
				<CommandGroup heading={`${table.name} — columns`}>
					{table.columns.map((column) => (
						<ColumnRow
							key={column.name}
							column={column}
							onSelect={() => onPick(column)}
						/>
					))}
				</CommandGroup>
			</CommandList>
		</>
	);
}

function TableRow({
	table,
	onSelect,
}: {
	readonly table: TableData;
	readonly onSelect: () => void;
}) {
	return (
		<CommandItem value={table.name} onSelect={onSelect}>
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
			<span className="font-mono text-xs text-foreground">{table.name}</span>
			<span className="ml-auto text-[9px] font-bold tracking-widest text-muted-foreground uppercase">
				{table.columns.length} cols
			</span>
		</CommandItem>
	);
}

function ColumnRow({
	column,
	onSelect,
}: {
	readonly column: ColumnData;
	readonly onSelect: () => void;
}) {
	return (
		<CommandItem value={column.name} onSelect={onSelect}>
			<span
				className="relative inline-block size-3 shrink-0 rounded-xs border border-[#a78bfa] bg-background"
				aria-hidden
			>
				<span
					className="absolute inset-[2px_2px_5px_2px] bg-[#a78bfa]"
					aria-hidden
				/>
			</span>
			<span className="font-mono text-xs text-foreground">{column.name}</span>
			<span className="ml-auto font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
				{column.type}
			</span>
		</CommandItem>
	);
}

function LinkerFoot({ stage }: { readonly stage: LinkerStage }) {
	return (
		<div className="flex items-center justify-between gap-2 border-t border-border bg-muted/40 px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
			{stage === "tables" ? (
				<>
					<KbdGroup>
						<Kbd>↑↓</Kbd>
						<span>navigate</span>
						<Kbd>
							<IconCornerDownLeft />
						</Kbd>
						<span>insert</span>
					</KbdGroup>
					<Kbd>Esc</Kbd>
				</>
			) : (
				<>
					<KbdGroup>
						<Kbd>⌫</Kbd>
						<span>back to tables</span>
					</KbdGroup>
					<KbdGroup>
						<Kbd>
							<IconCornerDownLeft />
						</Kbd>
						<span>insert</span>
					</KbdGroup>
				</>
			)}
		</div>
	);
}
