import {
	IconBinaryTree2,
	IconBorderNone,
	IconGridDots,
	IconLayoutGrid,
} from "@tabler/icons-react";
import type { ComponentType } from "react";

import { LAYOUT_ALGORITHM_OPTIONS } from "@/lib/layout-options";
import type { DiagramGridMode, DiagramLayoutAlgorithm } from "@/types";

export const GRID_OPTIONS: ReadonlyArray<{
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
		description: "A tighter dot field for easier freeform alignment.",
	},
	{
		value: "lines",
		label: "Line grid",
		description: "A tighter guide grid for structured layouts.",
	},
];

export const GRID_MODE_ICONS: Record<
	DiagramGridMode,
	ComponentType<{ className?: string }>
> = {
	none: IconBorderNone,
	dots: IconGridDots,
	lines: IconLayoutGrid,
};

export const LAYOUT_ALGORITHM_ICONS: Record<
	DiagramLayoutAlgorithm,
	ComponentType<{ className?: string }>
> = {
	"left-right": IconBinaryTree2,
	snowflake: IconLayoutGrid,
	compact: IconGridDots,
};

export const DOCK_SURFACE_CLASS =
	"pointer-events-auto inline-flex items-stretch overflow-hidden border border-border bg-background/96 text-foreground shadow-[0_18px_42px_color-mix(in_oklab,var(--foreground)_12%,transparent)] backdrop-blur-sm";

export const DOCK_POPOVER_CLASS =
	"border border-border bg-background p-0 gap-0 shadow-[0_18px_42px_color-mix(in_oklab,var(--foreground)_14%,transparent)] ring-0";

export const OPTION_CARD_CLASS =
	"flex w-full items-start gap-3 border-b border-border bg-background px-4 py-3 text-left transition-colors hover:bg-muted/55 last:border-b-0";

export { LAYOUT_ALGORITHM_OPTIONS };
