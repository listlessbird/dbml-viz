import type { DiagramLayoutAlgorithm } from "@/types";

export const LAYOUT_ALGORITHM_OPTIONS = [
	{
		id: "left-right",
		label: "Left-right",
		description: "Arrange tables from left to right based on relationship flow.",
	},
	{
		id: "snowflake",
		label: "Snowflake",
		description: "Spread connected tables around dense hubs for star-like schemas.",
	},
	{
		id: "compact",
		label: "Compact",
		description: "Pack the diagram into a tighter block for shorter overviews.",
	},
] as const satisfies ReadonlyArray<{
	id: DiagramLayoutAlgorithm;
	label: string;
	description: string;
}>;
