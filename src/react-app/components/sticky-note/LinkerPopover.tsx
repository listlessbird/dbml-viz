import { IconCornerDownLeft } from "@tabler/icons-react";
import { useNodes } from "@xyflow/react";
import { useMemo, useState } from "react";

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
import type { CanvasNode, ColumnData, TableData } from "@/types";

export type LinkerStage = "tables" | "columns";

interface LinkerPopoverProps {
	readonly onPickTable: (table: TableData) => void;
	readonly onPickColumn: (table: TableData, column: ColumnData) => void;
	readonly stage: LinkerStage;
	readonly scopedTable?: TableData | null;
	readonly onBackToTables: () => void;
	readonly onClose: () => void;
}

export function LinkerPopoverContent({
	onPickTable,
	onPickColumn,
	stage,
	scopedTable,
	onBackToTables,
	onClose,
}: LinkerPopoverProps) {
	const canvasNodes = useNodes<CanvasNode>();
	const [query, setQuery] = useState("");

	const canvasTables = useMemo(() => {
		const list: TableData[] = [];
		for (const node of canvasNodes) {
			if (node.type === "table") {
				list.push(node.data.table);
			}
		}
		return list;
	}, [canvasNodes]);

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
						tables={canvasTables}
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
}

interface TablesPanelProps {
	readonly tables: readonly TableData[];
	readonly query: string;
	readonly onQueryChange: (value: string) => void;
	readonly onPick: (table: TableData) => void;
}

function TablesPanel({ tables, query, onQueryChange, onPick }: TablesPanelProps) {
	const onCanvas = tables;
	// Deduplicate by name in a single O(n) pass; canvas tables and
	// additional tables are the same source today, but this shape lets the
	// "All tables" group grow later (e.g. catalog tables not on canvas).
	const all = useMemo<readonly TableData[]>(() => {
		const seen = new Set<string>();
		for (const t of tables) seen.add(t.name);
		const extras: TableData[] = [];
		for (const t of tables) {
			if (!seen.has(t.name)) extras.push(t);
		}
		return extras;
	}, [tables]);

	return (
		<>
			<CommandInput
				placeholder="type to filter…"
				value={query}
				onValueChange={onQueryChange}
			/>
			<CommandList>
				<CommandEmpty>No matches.</CommandEmpty>
				{onCanvas.length > 0 && (
					<CommandGroup heading="Tables on canvas">
						{onCanvas.map((table) => (
							<TableRow
								key={`canvas:${table.id}`}
								table={table}
								onSelect={() => onPick(table)}
							/>
						))}
					</CommandGroup>
				)}
				{all.length > 0 && (
					<CommandGroup heading="All tables">
						{all.map((table) => (
							<TableRow
								key={`all:${table.id}`}
								table={table}
								onSelect={() => onPick(table)}
							/>
						))}
					</CommandGroup>
				)}
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

function ColumnsPanel({ table, query, onQueryChange, onPick }: ColumnsPanelProps) {
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
					"relative inline-block size-3 shrink-0 rounded-xs border bg-background",
					"border-[#1e3a8a]",
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
				<span className="absolute inset-[2px_2px_5px_2px] bg-[#a78bfa]" aria-hidden />
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
