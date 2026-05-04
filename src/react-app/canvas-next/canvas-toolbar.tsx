import { IconNote } from "@tabler/icons-react";
import { memo, useCallback } from "react";

import { useCanvasRuntime } from "@/canvas-next/canvas-runtime-context";
import { spawnStickyNote } from "@/canvas-next/sticky-note/spawn";
import { useDiagramSession } from "@/diagram-session/diagram-session-context";

const screenCenter = () => ({
	x: typeof window === "undefined" ? 0 : window.innerWidth / 2,
	y: typeof window === "undefined" ? 0 : window.innerHeight / 2,
});

export const CanvasNextToolbar = memo(function CanvasNextToolbar() {
	const flowInstance = useCanvasRuntime((state) => state.flowInstance);
	const addStickyNote = useDiagramSession((state) => state.addStickyNote);

	const handleAddSticky = useCallback(() => {
		spawnStickyNote({
			flowInstance,
			addStickyNote,
			screenPoint: screenCenter(),
		});
	}, [flowInstance, addStickyNote]);

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
		</div>
	);
});
