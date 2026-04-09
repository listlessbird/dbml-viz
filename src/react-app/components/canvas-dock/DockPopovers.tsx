import { IconBinaryTree2, IconSearch } from "@tabler/icons-react";
import type { RefObject } from "react";

import { DockButton } from "@/components/canvas-dock/DockButton";
import {
	DOCK_POPOVER_CLASS,
	GRID_MODE_ICONS,
	GRID_OPTIONS,
	LAYOUT_ALGORITHM_ICONS,
	LAYOUT_ALGORITHM_OPTIONS,
	OPTION_CARD_CLASS,
} from "@/components/canvas-dock/constants";
import { Kbd } from "@/components/ui/kbd";
import {
	Popover,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DiagramGridMode } from "@/types";

interface GridDockPopoverProps {
	open: boolean;
	triggerId: string;
	gridMode: DiagramGridMode;
	onOpenChange: (open: boolean) => void;
	onSelectGridMode: (gridMode: DiagramGridMode) => void;
}

export function GridDockPopover({
	open,
	triggerId,
	gridMode,
	onOpenChange,
	onSelectGridMode,
}: GridDockPopoverProps) {
	const CurrentGridIcon = GRID_MODE_ICONS[gridMode];

	return (
		<Popover open={open} triggerId={triggerId} onOpenChange={onOpenChange}>
			<PopoverTrigger
				id={triggerId}
				render={
					<DockButton
						icon={CurrentGridIcon}
						label="Grid"
						shortcut="G"
						isActive={open || gridMode !== "none"}
						title="Canvas grid (G)"
						aria-label="Canvas grid"
					/>
				}
			/>
			<PopoverContent
				side="top"
				align="center"
				sideOffset={10}
				className={cn("w-72", DOCK_POPOVER_CLASS)}
			>
				<PopoverHeader className="border-b border-border px-4 py-3">
					<PopoverTitle className="text-sm">Canvas grid</PopoverTitle>
				</PopoverHeader>
				<div className="flex flex-col">
					{GRID_OPTIONS.map((option) => {
						const OptionIcon = GRID_MODE_ICONS[option.value];
						return (
							<button
								key={option.value}
								type="button"
								className={cn(
									OPTION_CARD_CLASS,
									gridMode === option.value && "bg-muted",
								)}
								onClick={() => onSelectGridMode(option.value)}
							>
								<div className="pt-0.5 text-foreground">
									<OptionIcon className="size-4" />
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
						);
					})}
				</div>
			</PopoverContent>
		</Popover>
	);
}

interface LayoutDockPopoverProps {
	open: boolean;
	triggerId: string;
	layoutAlgorithm: (typeof LAYOUT_ALGORITHM_OPTIONS)[number]["id"];
	isLayouting: boolean;
	onOpenChange: (open: boolean) => void;
	onApplyLayout: (id: (typeof LAYOUT_ALGORITHM_OPTIONS)[number]["id"]) => void;
}

export function LayoutDockPopover({
	open,
	triggerId,
	layoutAlgorithm,
	isLayouting,
	onOpenChange,
	onApplyLayout,
}: LayoutDockPopoverProps) {
	return (
		<Popover open={open} triggerId={triggerId} onOpenChange={onOpenChange}>
			<PopoverTrigger
				id={triggerId}
				render={
					<DockButton
						icon={IconBinaryTree2}
						label="Arrange"
						shortcut="L"
						isActive={open}
						title="Arrange diagram (L)"
						aria-label="Arrange diagram"
					/>
				}
			/>
			<PopoverContent
				side="top"
				align="center"
				sideOffset={10}
				className={cn("w-80", DOCK_POPOVER_CLASS)}
			>
				<PopoverHeader className="border-b border-border px-4 py-3">
					<PopoverTitle className="text-sm">Arrange layout</PopoverTitle>
				</PopoverHeader>
				<div className="flex flex-col">
					{LAYOUT_ALGORITHM_OPTIONS.map((option, index) => {
						const LayoutIcon = LAYOUT_ALGORITHM_ICONS[option.id];
						return (
							<button
								key={option.id}
								type="button"
								className={cn(
									OPTION_CARD_CLASS,
									layoutAlgorithm === option.id && "bg-muted",
								)}
								onClick={() => onApplyLayout(option.id)}
							>
								<div className="pt-0.5 text-foreground">
									<LayoutIcon className="size-4" />
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex items-start justify-between gap-3">
										<div className="text-sm font-medium text-foreground">
											{option.label}
										</div>
										<Kbd className="h-5 min-w-5 border border-border bg-muted px-1 text-[10px]">
											{index + 1}
										</Kbd>
									</div>
									<p className="mt-1 text-xs leading-5 text-muted-foreground">
										{option.description}
									</p>
								</div>
							</button>
						);
					})}
				</div>
				{isLayouting ? (
					<div className="border-t border-border px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
						Arranging diagram
					</div>
				) : null}
			</PopoverContent>
		</Popover>
	);
}

interface SearchDockPopoverProps {
	open: boolean;
	triggerId: string;
	searchQuery: string;
	matchedTableNames: readonly string[];
	searchInputRef: RefObject<HTMLInputElement | null>;
	onOpenChange: (open: boolean) => void;
	onSearchQueryChange: (query: string) => void;
	onSelectTable: (tableName: string) => void;
}

export function SearchDockPopover({
	open,
	triggerId,
	searchQuery,
	matchedTableNames,
	searchInputRef,
	onOpenChange,
	onSearchQueryChange,
	onSelectTable,
}: SearchDockPopoverProps) {
	return (
		<Popover open={open} triggerId={triggerId} onOpenChange={onOpenChange}>
			<PopoverTrigger
				id={triggerId}
				render={
					<DockButton
						icon={IconSearch}
						label="Search"
						shortcut="/"
						isActive={open || searchQuery.trim().length > 0}
						title="Search tables (/)"
						aria-label="Search tables"
					/>
				}
			/>
			<PopoverContent
				side="top"
				align="end"
				sideOffset={10}
				className={cn("w-80", DOCK_POPOVER_CLASS)}
			>
				<PopoverHeader className="border-b border-border px-4 py-3">
					<PopoverTitle className="text-sm">Search tables</PopoverTitle>
				</PopoverHeader>
				<div className="border-b border-border py-2">
					<div className="flex items-center gap-2 px-4">
						<IconSearch className="size-4 text-muted-foreground" aria-hidden />
						<label htmlFor="table-search" className="sr-only">
							Search tables
						</label>
						<input
							id="table-search"
							ref={searchInputRef}
							type="search"
							aria-label="Search tables"
							value={searchQuery}
							onChange={(event) => onSearchQueryChange(event.target.value)}
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
								className="flex w-full items-center border-b border-border px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted last:border-b-0"
								onClick={() => onSelectTable(tableName)}
							>
								{tableName}
							</button>
						))
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}
