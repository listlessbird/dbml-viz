import { useHotkeys } from "@tanstack/react-hotkeys";
import {
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
	type ComponentType,
	type KeyboardEvent,
} from "react";
import {
	IconBandage,
	IconDots,
	IconFocus2,
	IconHandMove,
	IconInfoCircle,
	IconLayoutGrid,
	IconLayoutSidebar,
	IconLock,
	IconMinus,
	IconNote,
	IconPlus,
	IconSearch,
	IconSelector,
} from "@/lib/tabler-icons";
import { CanvasLegendContent } from "@/canvas-next/canvas-legend/canvas-legend-content";
import { useCanvasRuntime } from "@/canvas-next/canvas-runtime-context";
import { spawnStickyNote } from "@/canvas-next/sticky-note/spawn";
import { useAutoArrangeCommand } from "@/canvas-next/use-auto-arrange-command";
import { useCanvasSearchEmphasis } from "@/canvas-next/use-canvas-search-emphasis";
import { useRepairOverlapsCommand } from "@/canvas-next/use-repair-overlaps-command";
import { DockButton } from "@/components/canvas-dock/DockButton";
import {
	DOCK_POPOVER_CLASS,
	DOCK_SEPARATOR_CLASS,
	DOCK_SURFACE_CLASS,
} from "@/components/canvas-dock/constants";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { useDiagramSession } from "@/diagram-session/diagram-session-context";
import { cn } from "@/lib/utils";

const screenCenter = () => ({
	x: typeof window === "undefined" ? 0 : window.innerWidth / 2,
	y: typeof window === "undefined" ? 0 : window.innerHeight / 2,
});

interface CanvasActionBarProps {
	readonly isSourceEditorOpen?: boolean;
	readonly onToggleSourceEditor?: () => void;
}

function DockSeparator() {
	return <span aria-hidden="true" className={DOCK_SEPARATOR_CLASS} />;
}

function ToolbarMenuButton({
	icon: Icon,
	label,
	shortcut,
	onClick,
	disabled,
}: {
	readonly icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
	readonly label: string;
	readonly shortcut?: string;
	readonly onClick: () => void;
	readonly disabled?: boolean;
}) {
	return (
		<button
			type="button"
			className="flex w-full items-center gap-2 rounded-toolbar-button px-2.5 py-2 text-left text-xs text-foreground outline-none transition-colors duration-fast ease-standard hover:bg-toolbar-hover focus-visible:bg-toolbar-hover disabled:pointer-events-none disabled:opacity-40"
			onClick={onClick}
			disabled={disabled}
		>
			<Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
			<span className="min-w-0 flex-1 truncate">{label}</span>
			{shortcut ? (
				<span
					aria-hidden="true"
					className="font-mono text-[10px] leading-none text-muted-foreground"
				>
					{shortcut}
				</span>
			) : null}
		</button>
	);
}

function HighlightedTableLabel({
	label,
	query,
}: {
	readonly label: string;
	readonly query: string;
}) {
	const trimmedQuery = query.trim();
	if (trimmedQuery.length === 0) return label;

	const start = label.toLowerCase().indexOf(trimmedQuery.toLowerCase());
	if (start === -1) return label;

	const end = start + trimmedQuery.length;
	return (
		<>
			{label.slice(0, start)}
			<span className="rounded-[2px] bg-primary/20 text-foreground">
				{label.slice(start, end)}
			</span>
			{label.slice(end)}
		</>
	);
}

export function CanvasActionBar({
	isSourceEditorOpen = false,
	onToggleSourceEditor,
}: CanvasActionBarProps) {
	const id = useId();
	const searchTriggerId = `${id}-search-trigger`;
	const legendTriggerId = `${id}-legend-trigger`;
	const moreTriggerId = `${id}-more-trigger`;
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const [isLegendOpen, setIsLegendOpen] = useState(false);
	const [isMoreOpen, setIsMoreOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [activeResultIndex, setActiveResultIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement | null>(null);

	const flowInstance = useCanvasRuntime((state) => state.flowInstance);
	const canvasInteractionMode = useCanvasRuntime(
		(state) => state.canvasInteractionMode,
	);
	const isLayoutLocked = useCanvasRuntime((state) => state.isLayoutLocked);
	const setCanvasInteractionMode = useCanvasRuntime(
		(state) => state.setCanvasInteractionMode,
	);
	const toggleCanvasPanMode = useCanvasRuntime(
		(state) => state.toggleCanvasPanMode,
	);
	const toggleLayoutLock = useCanvasRuntime((state) => state.toggleLayoutLock);
	const requestFocus = useCanvasRuntime((state) => state.requestFocus);
	const requestFitView = useCanvasRuntime((state) => state.requestFitView);
	const addStickyNote = useDiagramSession((state) => state.addStickyNote);
	const autoArrange = useAutoArrangeCommand();
	const repairOverlaps = useRepairOverlapsCommand();

	const handleSearchOpenChange = useCallback((open: boolean) => {
		setIsSearchOpen(open);
		if (!open) {
			setQuery("");
			setActiveResultIndex(0);
		}
	}, []);

	const handleAddSticky = useCallback(() => {
		spawnStickyNote({
			flowInstance,
			addStickyNote,
			screenPoint: screenCenter(),
		});
	}, [flowInstance, addStickyNote]);

	const handleAutoArrange = useCallback(() => {
		void autoArrange.run();
	}, [autoArrange]);

	const handleRepairOverlaps = useCallback(() => {
		void repairOverlaps.run();
	}, [repairOverlaps]);

	const handleFitView = useCallback(() => {
		requestFitView();
		setIsMoreOpen(false);
	}, [requestFitView]);

	const handleZoomIn = useCallback(() => {
		void flowInstance?.zoomIn({ duration: 180 });
		setIsMoreOpen(false);
	}, [flowInstance]);

	const handleZoomOut = useCallback(() => {
		void flowInstance?.zoomOut({ duration: 180 });
		setIsMoreOpen(false);
	}, [flowInstance]);

	const { matchedTables } = useCanvasSearchEmphasis(query);
	const activeSearchIndex =
		matchedTables.length === 0
			? 0
			: Math.min(activeResultIndex, matchedTables.length - 1);
	const activeMatchedTable = useMemo(() => {
		if (matchedTables.length === 0) return null;
		return matchedTables[activeSearchIndex] ?? null;
	}, [activeSearchIndex, matchedTables]);

	const handleSelectTable = useCallback(
		(tableId: string) => {
			requestFocus([tableId]);
			handleSearchOpenChange(false);
		},
		[handleSearchOpenChange, requestFocus],
	);

	const handleSearchKeyDown = useCallback(
		(event: KeyboardEvent<HTMLInputElement>) => {
			if (event.key === "Escape") {
				event.preventDefault();
				handleSearchOpenChange(false);
				return;
			}
			if (event.key === "ArrowDown") {
				event.preventDefault();
				setActiveResultIndex((index) =>
					matchedTables.length === 0
						? 0
						: Math.min(index + 1, matchedTables.length - 1),
				);
				return;
			}
			if (event.key === "ArrowUp") {
				event.preventDefault();
				setActiveResultIndex((index) => Math.max(index - 1, 0));
				return;
			}
			if (event.key === "Enter" && activeMatchedTable) {
				event.preventDefault();
				handleSelectTable(activeMatchedTable.id);
			}
		},
		[
			activeMatchedTable,
			handleSearchOpenChange,
			handleSelectTable,
			matchedTables.length,
		],
	);

	useEffect(() => {
		if (!isSearchOpen) return;
		inputRef.current?.focus();
		inputRef.current?.select();
	}, [isSearchOpen]);

	useHotkeys([
		{
			hotkey: "/",
			callback: (event) => {
				event.preventDefault();
				setIsSearchOpen(true);
			},
			options: {
				enabled: !isSearchOpen,
				ignoreInputs: true,
				meta: { name: "Open table search" },
			},
		},
		{
			hotkey: "Escape",
			callback: () => {
				handleSearchOpenChange(false);
				setIsLegendOpen(false);
				setIsMoreOpen(false);
			},
			options: {
				enabled: isSearchOpen || isLegendOpen || isMoreOpen,
				ignoreInputs: true,
				meta: { name: "Close canvas popover" },
			},
		},
		{
			hotkey: "1",
			callback: () => setCanvasInteractionMode("select"),
			options: {
				ignoreInputs: true,
				meta: { name: "Select canvas mode" },
			},
		},
		{
			hotkey: "H",
			callback: toggleCanvasPanMode,
			options: {
				ignoreInputs: true,
				meta: { name: "Toggle pan mode" },
			},
		},
		{
			hotkey: "L",
			callback: toggleLayoutLock,
			options: {
				ignoreInputs: true,
				meta: { name: "Lock layout" },
			},
		},
		{
			hotkey: "N",
			callback: handleAddSticky,
			options: {
				enabled: !!flowInstance,
				ignoreInputs: true,
				meta: { name: "Add sticky note" },
			},
		},
		{
			hotkey: "C",
			callback: () => onToggleSourceEditor?.(),
			options: {
				ignoreInputs: true,
				meta: { name: "Toggle schema source" },
			},
		},
		{
			hotkey: "A",
			callback: handleAutoArrange,
			options: {
				enabled: autoArrange.isAvailable,
				ignoreInputs: true,
				meta: { name: "Auto-arrange tables" },
			},
		},
		{
			hotkey: "R",
			callback: handleRepairOverlaps,
			options: {
				enabled: repairOverlaps.isAvailable,
				ignoreInputs: true,
				meta: { name: "Repair overlaps" },
			},
		},
		{
			hotkey: { key: "/", shift: true },
			callback: (event) => {
				event.preventDefault();
				setIsLegendOpen((open) => !open);
			},
			options: {
				ignoreInputs: true,
				meta: { name: "Toggle canvas legend" },
			},
		},
		{
			hotkey: "0",
			callback: handleFitView,
			options: {
				enabled: !!flowInstance,
				ignoreInputs: true,
				meta: { name: "Fit diagram" },
			},
		},
	]);

	return (
		<div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
			<div className="relative">
				<div className={DOCK_SURFACE_CLASS}>
					<DockButton
						icon={IconLock}
						label="Lock layout"
						shortcut="L"
						isActive={isLayoutLocked}
						onClick={toggleLayoutLock}
						title={
							isLayoutLocked
								? "Unlock diagram positions (l)"
								: "Lock diagram positions (l)"
						}
						aria-label={
							isLayoutLocked
								? "Unlock diagram positions"
								: "Lock diagram positions"
						}
					/>
					<DockButton
						icon={IconHandMove}
						label="Pan"
						shortcut="H"
						isActive={canvasInteractionMode === "pan"}
						onClick={toggleCanvasPanMode}
						title="Pan canvas (h)"
						aria-label="Pan canvas"
					/>
					<DockSeparator />
					<DockButton
						icon={IconSelector}
						label="Select"
						shortcut="1"
						isActive={canvasInteractionMode === "select"}
						onClick={() => setCanvasInteractionMode("select")}
						title="Select and move tables (1)"
						aria-label="Select canvas objects"
					/>
					<DockSeparator />
					<DockButton
						icon={IconNote}
						label="Note"
						shortcut="N"
						onClick={handleAddSticky}
						disabled={!flowInstance}
						title="Add sticky note (n)"
						aria-label="Add sticky note"
					/>
					<DockButton
						icon={IconLayoutGrid}
						label="Arrange"
						shortcut="A"
						onClick={handleAutoArrange}
						disabled={!autoArrange.isAvailable}
						title="Auto-arrange tables (a)"
						aria-label="Auto-arrange tables"
					/>
					<DockButton
						icon={IconBandage}
						label="Repair"
						shortcut="R"
						onClick={handleRepairOverlaps}
						disabled={!repairOverlaps.isAvailable}
						title="Repair overlaps (r)"
						aria-label="Repair overlapping tables"
					/>
					<DockSeparator />
					<Popover
						open={isSearchOpen}
						triggerId={searchTriggerId}
						onOpenChange={handleSearchOpenChange}
					>
						<PopoverTrigger
							id={searchTriggerId}
							render={
								<DockButton
									icon={IconSearch}
									label="Search"
									shortcut="/"
									isActive={isSearchOpen || query.trim().length > 0}
									title="Search tables (/)"
									aria-label="Search tables"
								/>
							}
						/>
						<PopoverContent
							side="top"
							align="center"
							sideOffset={10}
							className={cn("w-80", DOCK_POPOVER_CLASS)}
						>
							<div className="flex items-center gap-2 border-b border-toolbar-border px-3 py-2.5 text-muted-foreground">
								<IconSearch className="size-4 shrink-0" aria-hidden />
								<label htmlFor="canvas-search" className="sr-only">
									Search tables
								</label>
								<input
									id="canvas-search"
									ref={inputRef}
									type="search"
									aria-label="Search tables"
									value={query}
									onChange={(event) => {
										setQuery(event.target.value);
										setActiveResultIndex(0);
									}}
									onKeyDown={handleSearchKeyDown}
									placeholder="Table name"
									className="h-7 min-w-0 flex-1 bg-transparent font-mono text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
								/>
								<span
									aria-hidden="true"
									className="font-mono text-[10px] leading-none text-muted-foreground"
								>
									Enter
								</span>
							</div>
							<div className="max-h-56 overflow-y-auto p-1.5">
								{query.trim().length === 0 ? (
									<div className="px-2.5 py-2 text-xs text-muted-foreground">
										Type a table name.
									</div>
								) : matchedTables.length === 0 ? (
									<div className="px-2.5 py-2 text-xs text-muted-foreground">
										No matching tables.
									</div>
								) : (
									matchedTables.map((table, index) => (
										<button
											key={table.id}
											type="button"
											data-active={index === activeSearchIndex}
											className="flex w-full items-baseline gap-2 rounded-toolbar-button px-2.5 py-2 text-left font-mono text-[13px] text-foreground outline-none transition-colors duration-fast ease-standard hover:bg-toolbar-hover focus-visible:bg-toolbar-hover data-[active=true]:bg-toolbar-active data-[active=true]:text-toolbar-active-foreground"
											onMouseEnter={() => setActiveResultIndex(index)}
											onClick={() => handleSelectTable(table.id)}
										>
											<span className="min-w-0 flex-1 truncate">
												<HighlightedTableLabel
													label={table.name}
													query={query}
												/>
											</span>
											{table.schema ? (
												<span className="shrink-0 text-[11px] text-muted-foreground">
													{table.schema}
												</span>
											) : null}
										</button>
									))
								)}
							</div>
						</PopoverContent>
					</Popover>
					<Popover
						open={isLegendOpen}
						triggerId={legendTriggerId}
						onOpenChange={setIsLegendOpen}
					>
						<PopoverTrigger
							id={legendTriggerId}
							render={
								<DockButton
									icon={IconInfoCircle}
									label="Legend"
									shortcut="?"
									isActive={isLegendOpen}
									title="Show canvas legend (?)"
									aria-label="Show canvas legend"
								/>
							}
						/>
						<PopoverContent
							side="top"
							align="center"
							sideOffset={10}
							className={cn("w-80", DOCK_POPOVER_CLASS)}
						>
							<div className="border-b border-toolbar-border px-3 py-2.5 text-sm font-medium">
								Canvas legend
							</div>
							<CanvasLegendContent />
						</PopoverContent>
					</Popover>
					<DockButton
						icon={IconLayoutSidebar}
						label="Code"
						shortcut="C"
						isActive={isSourceEditorOpen}
						onClick={onToggleSourceEditor}
						title={
							isSourceEditorOpen
								? "Hide schema source (c)"
								: "Show schema source (c)"
						}
						aria-label={
							isSourceEditorOpen
								? "Hide schema source editor"
								: "Show schema source editor"
						}
					/>
				</div>
				<div className="absolute top-0 left-[calc(100%+8px)] hidden sm:block">
					<Popover
						open={isMoreOpen}
						triggerId={moreTriggerId}
						onOpenChange={setIsMoreOpen}
					>
						<div className={DOCK_SURFACE_CLASS}>
							<PopoverTrigger
								id={moreTriggerId}
								render={
									<DockButton
									icon={IconDots}
										label="More"
										isActive={isMoreOpen}
										title="More canvas actions"
										aria-label="More canvas actions"
									/>
								}
							/>
						</div>
						<PopoverContent
							side="top"
							align="end"
							sideOffset={10}
							className={cn("w-44 p-1.5", DOCK_POPOVER_CLASS)}
						>
							<ToolbarMenuButton
								icon={IconFocus2}
								label="Fit diagram"
								shortcut="0"
								onClick={handleFitView}
								disabled={!flowInstance}
							/>
							<ToolbarMenuButton
								icon={IconPlus}
								label="Zoom in"
								onClick={handleZoomIn}
								disabled={!flowInstance}
							/>
							<ToolbarMenuButton
								icon={IconMinus}
								label="Zoom out"
								onClick={handleZoomOut}
								disabled={!flowInstance}
							/>
						</PopoverContent>
					</Popover>
				</div>
			</div>
		</div>
	);
}
