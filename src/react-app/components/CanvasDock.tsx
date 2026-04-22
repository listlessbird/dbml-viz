import { IconNote } from "@tabler/icons-react";
import { useHotkeys } from "@tanstack/react-hotkeys";
import { useEffect, useId, useRef, useState } from "react";

import { DockButton } from "@/components/canvas-dock/DockButton";
import {
	GridDockPopover,
	LayoutDockPopover,
	SearchDockPopover,
} from "@/components/canvas-dock/DockPopovers";
import { DOCK_SURFACE_CLASS, LAYOUT_ALGORITHM_OPTIONS } from "@/components/canvas-dock/constants";
import { useDiagramUiStore } from "@/store/useDiagramUiStore";
import type { DiagramLayoutAlgorithm } from "@/types";

interface CanvasDockProps {
	readonly isLayouting: boolean;
	readonly matchedTableNames: readonly string[];
	readonly onAutoLayout: (layoutAlgorithm?: DiagramLayoutAlgorithm) => void;
	readonly onFitView: () => void;
	readonly onZoomIn: () => void;
	readonly onZoomOut: () => void;
	readonly onAddStickyNote: () => void;
}

export function CanvasDock({
	isLayouting,
	matchedTableNames,
	onAutoLayout,
	onFitView,
	onZoomIn,
	onZoomOut,
	onAddStickyNote,
}: CanvasDockProps) {
	const dockId = useId();
	const [isGridOpen, setGridOpen] = useState(false);
	const [isLayoutOpen, setLayoutOpen] = useState(false);
	const [isSearchOpen, setSearchOpen] = useState(false);
	const searchInputRef = useRef<HTMLInputElement | null>(null);

	const gridMode = useDiagramUiStore((state) => state.gridMode);
	const layoutAlgorithm = useDiagramUiStore((state) => state.layoutAlgorithm);
	const searchQuery = useDiagramUiStore((state) => state.searchQuery);
	const setGridMode = useDiagramUiStore((state) => state.setGridMode);
	const setLayoutAlgorithm = useDiagramUiStore((state) => state.setLayoutAlgorithm);
	const setSearchQuery = useDiagramUiStore((state) => state.setSearchQuery);
	const togglePanMode = useDiagramUiStore((state) => state.togglePanMode);

	const panelsAreOpen = isGridOpen || isLayoutOpen || isSearchOpen;
	const gridTriggerId = `${dockId}-grid-trigger`;
	const layoutTriggerId = `${dockId}-layout-trigger`;
	const searchTriggerId = `${dockId}-search-trigger`;

	const closePanels = () => {
		setGridOpen(false);
		setLayoutOpen(false);
		setSearchOpen(false);
	};

	const openGrid = () => {
		setGridOpen(true);
		setLayoutOpen(false);
		setSearchOpen(false);
	};

	const openLayout = () => {
		setGridOpen(false);
		setLayoutOpen(true);
		setSearchOpen(false);
	};

	const openSearch = () => {
		setGridOpen(false);
		setLayoutOpen(false);
		setSearchOpen(true);
	};

	const applyLayout = (id: (typeof LAYOUT_ALGORITHM_OPTIONS)[number]["id"]) => {
		console.info("[layout] dock applyLayout", {
			nextLayoutAlgorithm: id,
			currentLayoutAlgorithm: layoutAlgorithm,
			isLayouting,
		});
		setLayoutAlgorithm(id);
		setLayoutOpen(false);
		onAutoLayout(id);
	};

	useEffect(() => {
		if (!isSearchOpen) {
			return;
		}

		searchInputRef.current?.focus();
		searchInputRef.current?.select();
	}, [isSearchOpen]);

	useHotkeys([
		{
			hotkey: "G",
			callback: openGrid,
			options: { meta: { name: "Toggle grid dock" } },
		},
		{
			hotkey: "L",
			callback: openLayout,
			options: { meta: { name: "Toggle arrange dock" } },
		},
		{
			hotkey: "/",
			callback: openSearch,
			options: {
				enabled: !isSearchOpen,
				ignoreInputs: false,
				meta: { name: "Open table search" },
			},
		},
		{
			hotkey: "Escape",
			callback: closePanels,
			options: {
				enabled: panelsAreOpen,
				ignoreInputs: true,
				meta: { name: "Close open dock panels" },
			},
		},
		{
			hotkey: "1",
			callback: () => applyLayout("left-right"),
			options: {
				enabled: isLayoutOpen,
				meta: { name: "Arrange layout: left-right" },
			},
		},
		{
			hotkey: "2",
			callback: () => applyLayout("snowflake"),
			options: {
				enabled: isLayoutOpen,
				meta: { name: "Arrange layout: snowflake" },
			},
		},
		{
			hotkey: "3",
			callback: () => applyLayout("compact"),
			options: {
				enabled: isLayoutOpen,
				meta: { name: "Arrange layout: compact" },
			},
		},
		{
			hotkey: "-",
			callback: onZoomOut,
			options: { meta: { name: "Zoom out" } },
		},
		{
			hotkey: "=",
			callback: onZoomIn,
			options: { meta: { name: "Zoom in" } },
		},
		{
			hotkey: "0",
			callback: onFitView,
			options: { meta: { name: "Fit view" } },
		},
		{
			hotkey: "P",
			callback: togglePanMode,
			options: { meta: { name: "Toggle pan mode" } },
		},
		{
			hotkey: "N",
			callback: onAddStickyNote,
			options: { meta: { name: "Add sticky note" } },
		},
	]);

	return (
		<div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2">
			<div className={DOCK_SURFACE_CLASS}>
				<GridDockPopover
					open={isGridOpen}
					triggerId={gridTriggerId}
					gridMode={gridMode}
					onOpenChange={(open) => {
						setGridOpen(open);
						if (open) {
							setLayoutOpen(false);
							setSearchOpen(false);
						}
					}}
					onSelectGridMode={(nextGridMode) => {
						setGridMode(nextGridMode);
						setGridOpen(false);
					}}
				/>

				<LayoutDockPopover
					open={isLayoutOpen}
					triggerId={layoutTriggerId}
					layoutAlgorithm={layoutAlgorithm}
					isLayouting={isLayouting}
					onOpenChange={(open) => {
						setLayoutOpen(open);
						if (open) {
							setGridOpen(false);
							setSearchOpen(false);
						}
					}}
					onApplyLayout={applyLayout}
				/>

				<DockButton
					icon={IconNote}
					label="Note"
					shortcut="N"
					title="Add sticky note (N)"
					aria-label="Add sticky note"
					onClick={onAddStickyNote}
				/>

				<SearchDockPopover
					open={isSearchOpen}
					triggerId={searchTriggerId}
					searchQuery={searchQuery}
					matchedTableNames={matchedTableNames}
					searchInputRef={searchInputRef}
					onOpenChange={(open) => {
						setSearchOpen(open);
						if (open) {
							setGridOpen(false);
							setLayoutOpen(false);
						}
					}}
					onSearchQueryChange={setSearchQuery}
					onSelectTable={(tableName) => {
						setSearchQuery(tableName);
						setSearchOpen(false);
					}}
				/>
			</div>
		</div>
	);
}
