import {
	IconBandage,
	IconLayoutGrid,
	IconLayoutSidebar,
	IconNote,
} from "@tabler/icons-react";
import { memo, useCallback } from "react";

import { useCanvasRuntime } from "@/canvas-next/canvas-runtime-context";
import { spawnStickyNote } from "@/canvas-next/sticky-note/spawn";
import { useAutoArrangeCommand } from "@/canvas-next/use-auto-arrange-command";
import { useRepairOverlapsCommand } from "@/canvas-next/use-repair-overlaps-command";
import { useDiagramSession } from "@/diagram-session/diagram-session-context";

const screenCenter = () => ({
	x: typeof window === "undefined" ? 0 : window.innerWidth / 2,
	y: typeof window === "undefined" ? 0 : window.innerHeight / 2,
});

interface CanvasNextToolbarProps {
	readonly isSourceEditorOpen?: boolean;
	readonly onToggleSourceEditor?: () => void;
}

export const CanvasNextToolbar = memo(function CanvasNextToolbar({
	isSourceEditorOpen = false,
	onToggleSourceEditor,
}: CanvasNextToolbarProps) {
	const flowInstance = useCanvasRuntime((state) => state.flowInstance);
	const addStickyNote = useDiagramSession((state) => state.addStickyNote);
	const autoArrange = useAutoArrangeCommand();
	const repairOverlaps = useRepairOverlapsCommand();

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

	return (
		<div
			data-testid="canvas-next-toolbar"
			className="pointer-events-none absolute left-3 top-3 z-10 flex gap-2"
		>
			<button
				type="button"
				data-testid="canvas-next-add-sticky"
				disabled={!flowInstance}
				onClick={handleAddSticky}
				className="pointer-events-auto inline-flex items-center gap-1.5 rounded-sm border border-border bg-background/95 px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
				title="Add sticky note"
				aria-label="Add sticky note"
			>
				<IconNote className="size-3.5" />
				<span>Sticky note</span>
			</button>
			<button
				type="button"
				data-testid="canvas-next-auto-arrange"
				disabled={!autoArrange.isAvailable}
				onClick={handleAutoArrange}
				className="pointer-events-auto inline-flex items-center gap-1.5 rounded-sm border border-border bg-background/95 px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
				title="Auto-arrange tables"
				aria-label="Auto-arrange tables"
			>
				<IconLayoutGrid className="size-3.5" />
				<span>Auto-arrange</span>
			</button>
			<button
				type="button"
				data-testid="canvas-next-repair-overlaps"
				disabled={!repairOverlaps.isAvailable}
				onClick={handleRepairOverlaps}
				className="pointer-events-auto inline-flex items-center gap-1.5 rounded-sm border border-border bg-background/95 px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
				title="Repair overlaps"
				aria-label="Repair overlapping tables"
			>
				<IconBandage className="size-3.5" />
				<span>Repair overlaps</span>
			</button>
			<button
				type="button"
				data-testid="canvas-next-toggle-source-editor"
				onClick={onToggleSourceEditor}
				className="pointer-events-auto inline-flex items-center gap-1.5 rounded-sm border border-border bg-background/95 px-2.5 py-1.5 text-xs font-medium shadow-sm backdrop-blur transition-colors hover:bg-accent hover:text-accent-foreground"
				title={
					isSourceEditorOpen ? "Hide schema source" : "Show schema source"
				}
				aria-label={
					isSourceEditorOpen
						? "Hide schema source editor"
						: "Show schema source editor"
				}
				aria-pressed={isSourceEditorOpen}
			>
				<IconLayoutSidebar className="size-3.5" />
				<span>Schema source</span>
			</button>
		</div>
	);
});
