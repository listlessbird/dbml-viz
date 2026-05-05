import { IconLayoutSidebar, IconNote, IconSearch } from "@tabler/icons-react";
import { useHotkeys } from "@tanstack/react-hotkeys";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { useCanvasRuntime } from "@/canvas-next/canvas-runtime-context";
import { spawnStickyNote } from "@/canvas-next/sticky-note/spawn";
import { useDiagramSession } from "@/diagram-session/diagram-session-context";

import { DockButton } from "@/components/canvas-dock/DockButton";
import {
	DOCK_POPOVER_CLASS,
	DOCK_SURFACE_CLASS,
} from "@/components/canvas-dock/constants";
import {
	Popover,
	PopoverContent,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@/components/ui/popover";
import { useCanvasSearchEmphasis } from "@/canvas-next/use-canvas-search-emphasis";
import { cn } from "@/lib/utils";

const screenCenter = () => ({
	x: typeof window === "undefined" ? 0 : window.innerWidth / 2,
	y: typeof window === "undefined" ? 0 : window.innerHeight / 2,
});

export interface CanvasSearchDockProps {
	readonly isSourceEditorOpen?: boolean;
	readonly onToggleSourceEditor?: () => void;
}

export function CanvasSearchDock({
	isSourceEditorOpen = false,
	onToggleSourceEditor,
}: CanvasSearchDockProps) {
	const id = useId();
	const triggerId = `${id}-search-trigger`;
	const [isOpen, setIsOpen] = useState(false);
	const [query, setQuery] = useState("");
	const inputRef = useRef<HTMLInputElement | null>(null);

	const flowInstance = useCanvasRuntime((state) => state.flowInstance);
	const addStickyNote = useDiagramSession((state) => state.addStickyNote);

	const handleAddSticky = useCallback(() => {
		spawnStickyNote({
			flowInstance,
			addStickyNote,
			screenPoint: screenCenter(),
		});
	}, [flowInstance, addStickyNote]);

	const { matchedTableNames, focusMatched } = useCanvasSearchEmphasis(query);

	useEffect(() => {
		if (!isOpen) return;
		inputRef.current?.focus();
		inputRef.current?.select();
	}, [isOpen]);

	useHotkeys([
		{
			hotkey: "/",
			callback: () => setIsOpen(true),
			options: {
				enabled: !isOpen,
				ignoreInputs: false,
				meta: { name: "Open table search" },
			},
		},
		{
			hotkey: "Escape",
			callback: () => setIsOpen(false),
			options: {
				enabled: isOpen,
				ignoreInputs: true,
				meta: { name: "Close search" },
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
	]);

	const handleSelect = (tableName: string) => {
		setQuery(tableName);
		focusMatched();
		setIsOpen(false);
	};

	return (
		<div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
			<div className={DOCK_SURFACE_CLASS}>
				<DockButton
					icon={IconNote}
					label="Note"
					shortcut="n"
					onClick={handleAddSticky}
					disabled={!flowInstance}
					title="Add sticky note (n)"
					aria-label="Add sticky note"
				/>
				<DockButton
					icon={IconLayoutSidebar}
					label="Code"
					shortcut="c"
					isActive={isSourceEditorOpen}
					onClick={onToggleSourceEditor}
					title={isSourceEditorOpen ? "Hide schema source (c)" : "Show schema source (c)"}
					aria-label={
						isSourceEditorOpen
							? "Hide schema source editor"
							: "Show schema source editor"
					}
				/>
				<Popover
					open={isOpen}
					triggerId={triggerId}
					onOpenChange={(open) => {
						setIsOpen(open);
						if (!open) setQuery("");
					}}
				>
					<PopoverTrigger
						id={triggerId}
						render={
							<DockButton
								icon={IconSearch}
								label="Search"
								shortcut="/"
								isActive={isOpen || query.trim().length > 0}
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
								<label htmlFor="canvas-search" className="sr-only">
									Search tables
								</label>
								<input
									id="canvas-search"
									ref={inputRef}
									type="search"
									aria-label="Search tables"
									value={query}
									onChange={(event) => setQuery(event.target.value)}
									placeholder="Type a table name"
									className="h-10 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
								/>
							</div>
						</div>
						<div className="max-h-56 overflow-y-auto">
							{query.trim().length === 0 ? (
								<div className="px-4 py-3 text-xs text-muted-foreground">
									Start typing to find tables.
								</div>
							) : matchedTableNames.length === 0 ? (
								<div className="px-4 py-3 text-xs text-muted-foreground">
									No matching tables.
								</div>
							) : (
								matchedTableNames.map((tableName) => (
									<button
										key={tableName}
										type="button"
										className="flex w-full items-center border-b border-border px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted last:border-b-0"
										onClick={() => handleSelect(tableName)}
									>
										{tableName}
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
