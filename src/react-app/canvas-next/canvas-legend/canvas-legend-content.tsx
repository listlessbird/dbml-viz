import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface LegendEntry {
	readonly id: string;
	readonly label: string;
	readonly description: string;
	readonly glyph: ReactNode;
}

const LEGEND_ENTRIES: readonly LegendEntry[] = [
	{
		id: "primary-key",
		label: "Primary Key",
		description: "Uniquely identifies each row",
		glyph: (
			<GlyphChar className="schema-column-key--pk" symbol="⚿" />
		),
	},
	{
		id: "foreign-key",
		label: "Foreign Key",
		description: "References another table",
		glyph: <GlyphChar className="schema-column-key--fk" symbol="→" />,
	},
	{
		id: "indexed",
		label: "Indexed",
		description: "Column appears in a non-primary index",
		glyph: <GlyphBadge>IDX</GlyphBadge>,
	},
	{
		id: "unique",
		label: "Unique",
		description: "Column is part of a unique constraint",
		glyph: <GlyphBadge>UQ</GlyphBadge>,
	},
	{
		id: "nullable",
		label: "Nullable",
		description: "Column allows NULL values",
		glyph: <GlyphChar className="schema-column-key--plain" symbol="·" />,
	},
	{
		id: "selected-relationship",
		label: "Selected Relationship",
		description: "Clicked edge highlights endpoint tables and columns",
		glyph: (
			<span
				aria-hidden
				className="inline-flex h-3 w-6 items-center"
				style={{
					borderTop: "2px solid var(--primary)",
				}}
			/>
		),
	},
	{
		id: "search-highlight",
		label: "Search highlight",
		description: "Tables matching the active search query",
		glyph: (
			<span
				aria-hidden
				className="inline-block h-3 w-3 border border-primary bg-primary/15"
			/>
		),
	},
];

function GlyphChar({
	className,
	symbol,
}: {
	readonly className?: string;
	readonly symbol: string;
}) {
	return (
		<span
			aria-hidden
			className={cn(
				"schema-column-key inline-flex h-5 w-5 items-center justify-center text-base leading-none",
				className,
			)}
		>
			{symbol}
		</span>
	);
}

function GlyphBadge({ children }: { readonly children: ReactNode }) {
	return (
		<span
			aria-hidden
			className="inline-flex h-4 min-w-7 items-center justify-center border border-border bg-muted px-1 font-mono text-[9px] font-medium tracking-wider text-muted-foreground"
		>
			{children}
		</span>
	);
}

export function CanvasLegendContent() {
	return (
		<ul
			data-testid="canvas-legend-list"
			className="flex flex-col"
		>
			{LEGEND_ENTRIES.map((entry) => (
				<li
					key={entry.id}
					className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
				>
					<span className="flex h-5 w-6 shrink-0 items-center justify-center">
						{entry.glyph}
					</span>
					<div className="min-w-0">
						<p className="text-xs font-medium text-foreground">
							{entry.label}
						</p>
						<p className="text-[11px] text-muted-foreground">
							{entry.description}
						</p>
					</div>
				</li>
			))}
		</ul>
	);
}
