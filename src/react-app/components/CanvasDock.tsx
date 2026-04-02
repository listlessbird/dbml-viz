import {
	IconBinaryTree2,
	IconGridDots,
	IconLayoutGrid,
	IconSearch,
} from "@tabler/icons-react";
import { useState } from "react";

import {
	Popover,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
import { LAYOUT_ALGORITHM_OPTIONS } from "@/lib/layout";
import { cn } from "@/lib/utils";
import { useDiagramUiStore } from "@/store/useDiagramUiStore";
import type { DiagramGridMode } from "@/types";

interface CanvasDockProps {
	readonly isLayouting: boolean;
	readonly matchedTableNames: readonly string[];
	readonly onAutoLayout: () => void;
}

const GRID_OPTIONS: ReadonlyArray<{
	value: DiagramGridMode;
	label: string;
	description: string;
}> = [
	{
		value: "none",
		label: "Grid off",
		description: "Keep the canvas completely clean.",
	},
	{
		value: "dots",
		label: "Dot grid",
		description: "A subtle drafting grid for freeform placement.",
	},
	{
		value: "lines",
		label: "Line grid",
		description: "A stronger grid for more structured layouts.",
	},
];

const dockButtonClass =
	"inline-flex h-11 w-11 items-center justify-center border-r border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[active=true]:bg-muted data-[active=true]:text-foreground";

const optionCardClass =
	"flex w-full items-start gap-3 border-b border-border bg-background px-4 py-3 text-left transition-colors hover:bg-muted/55 last:border-b-0";

export function CanvasDock({
	isLayouting,
	matchedTableNames,
	onAutoLayout,
}: CanvasDockProps) {
	const [isGridOpen, setGridOpen] = useState(false);
	const [isLayoutOpen, setLayoutOpen] = useState(false);
	const [isSearchOpen, setSearchOpen] = useState(false);
	const gridMode = useDiagramUiStore((state) => state.gridMode);
	const layoutAlgorithm = useDiagramUiStore((state) => state.layoutAlgorithm);
	const searchQuery = useDiagramUiStore((state) => state.searchQuery);
	const setGridMode = useDiagramUiStore((state) => state.setGridMode);
	const setLayoutAlgorithm = useDiagramUiStore((state) => state.setLayoutAlgorithm);
	const setSearchQuery = useDiagramUiStore((state) => state.setSearchQuery);

	return (
		<div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
			<div className="pointer-events-auto inline-flex items-stretch overflow-hidden border border-border bg-background/96 text-foreground shadow-[0_18px_42px_color-mix(in_oklab,var(--foreground)_12%,transparent)] backdrop-blur-sm">
				<Popover open={isGridOpen} onOpenChange={setGridOpen}>
					<PopoverTrigger
						render={
							<button
								type="button"
								className={dockButtonClass}
								data-active={isGridOpen || gridMode !== "none"}
								title="Grid controls"
							>
								<IconGridDots className="size-4" />
							</button>
						}
					/>
					<PopoverContent
						side="top"
						align="center"
						sideOffset={10}
						className="w-72 border border-border bg-background p-0 gap-0 shadow-[0_18px_42px_color-mix(in_oklab,var(--foreground)_14%,transparent)] ring-0"
					>
						<PopoverHeader className="border-b border-border px-4 py-3">
							<PopoverTitle className="text-sm">Canvas grid</PopoverTitle>
						</PopoverHeader>
						<div className="flex flex-col">
							{GRID_OPTIONS.map((option) => (
								<button
									key={option.value}
									type="button"
									className={cn(
										optionCardClass,
										gridMode === option.value && "bg-muted",
									)}
									onClick={() => {
										setGridMode(option.value);
										setGridOpen(false);
									}}
								>
									<div className="pt-0.5 text-foreground">
										<IconGridDots className="size-4" />
									</div>
									<div className="min-w-0">
										<div className="text-sm font-medium text-foreground">
											{option.label}
										</div>
										<p className="mt-1 text-xs leading-5 text-muted-foreground">
											{option.description}
										</p>
									</div>
								</button>
							))}
						</div>
					</PopoverContent>
				</Popover>

				<Popover open={isLayoutOpen} onOpenChange={setLayoutOpen}>
					<PopoverTrigger
						render={
							<button
								type="button"
								className={dockButtonClass}
								data-active={isLayoutOpen}
								title="Arrange diagram"
							>
								<IconBinaryTree2 className="size-4" />
							</button>
						}
					/>
					<PopoverContent
						side="top"
						align="center"
						sideOffset={10}
						className="w-80 border border-border bg-background p-0 gap-0 shadow-[0_18px_42px_color-mix(in_oklab,var(--foreground)_14%,transparent)] ring-0"
					>
						<PopoverHeader className="border-b border-border px-4 py-3">
							<PopoverTitle className="text-sm">
								Choose auto arrange algorithm
							</PopoverTitle>
						</PopoverHeader>
						<div className="flex flex-col">
							{LAYOUT_ALGORITHM_OPTIONS.map((option, index) => (
								<button
									key={option.id}
									type="button"
									className={cn(
										optionCardClass,
										layoutAlgorithm === option.id && "bg-muted",
									)}
									onClick={() => {
										setLayoutAlgorithm(option.id);
										setLayoutOpen(false);
										onAutoLayout();
									}}
								>
									<div className="pt-0.5 text-foreground">
										{option.id === "snowflake" ? (
											<IconLayoutGrid className="size-4" />
										) : option.id === "compact" ? (
											<IconGridDots className="size-4" />
										) : (
											<IconBinaryTree2 className="size-4" />
										)}
									</div>
									<div className="min-w-0 flex-1">
										<div className="flex items-start justify-between gap-3">
											<div className="text-sm font-medium text-foreground">
												{option.label}
											</div>
											<span className="border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
												{index + 1}
											</span>
										</div>
										<p className="mt-1 text-xs leading-5 text-muted-foreground">
											{option.description}
										</p>
									</div>
								</button>
							))}
						</div>
						{isLayouting ? (
							<div className="border-t border-border px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
								Arranging diagram
							</div>
						) : null}
					</PopoverContent>
				</Popover>

				<Popover open={isSearchOpen} onOpenChange={setSearchOpen}>
					<PopoverTrigger
						render={
							<button
								type="button"
								className="inline-flex h-11 w-11 items-center justify-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[active=true]:bg-muted data-[active=true]:text-foreground"
								data-active={isSearchOpen || searchQuery.trim().length > 0}
								title="Search tables"
							>
								<IconSearch className="size-4" />
							</button>
						}
					/>
					<PopoverContent
						side="top"
						align="end"
						sideOffset={10}
						className="w-80 border border-border bg-background p-0 gap-0 shadow-[0_18px_42px_color-mix(in_oklab,var(--foreground)_14%,transparent)] ring-0"
					>
						<PopoverHeader className="border-b border-border px-4 py-3">
							<PopoverTitle className="text-sm">Search tables</PopoverTitle>
						</PopoverHeader>
						<div className="border-b border-border py-2">
							<div className="flex items-center gap-2 px-4">
								<IconSearch className="size-4 text-muted-foreground" />
								<input
									autoFocus
									type="search"
									value={searchQuery}
									onChange={(event) => {
										setSearchQuery(event.target.value);
									}}
									placeholder="Type a table name"
									className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
								/>
							</div>
						</div>
						<div className="max-h-56 overflow-y-auto">
							{matchedTableNames.length === 0 ? (
								<div className="px-4 py-3 text-xs text-muted-foreground">
									No matching tables.
								</div>
							) : (
								matchedTableNames.map((tableName) => (
									<button
										key={tableName}
										type="button"
										className="flex w-full items-center justify-between border-b border-border px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted last:border-b-0"
										onClick={() => {
											setSearchQuery(tableName);
											setSearchOpen(false);
										}}
									>
										<span className="truncate">{tableName}</span>
										<IconSearch className="size-3.5 text-muted-foreground" />
									</button>
								))
							)}
						</div>
					</PopoverContent>
				</Popover>
			</div>
		</div>
	);
}
