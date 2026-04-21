import {
	BaseEdge,
	getSmoothStepPath,
	type EdgeProps,
} from "@xyflow/react";
import { memo } from "react";

import type { StickyLinkEdge as StickyLinkEdgeType } from "@/types";

const STROKE_BY_COLOR: Record<string, string> = {
	yellow: "var(--sticky-yellow-dashed)",
	pink: "var(--sticky-pink-dashed)",
	blue: "var(--sticky-blue-dashed)",
	green: "var(--sticky-green-dashed)",
};

export const StickyLinkEdge = memo(function StickyLinkEdge({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	data,
}: EdgeProps<StickyLinkEdgeType>) {
	const [edgePath] = getSmoothStepPath({
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
		borderRadius: 14,
	});

	const stroke =
		(data?.color && STROKE_BY_COLOR[data.color]) ??
		"color-mix(in oklab, var(--foreground) 42%, transparent)";

	return (
		<BaseEdge
			id={id}
			path={edgePath}
			interactionWidth={18}
			style={{
				stroke,
				strokeWidth: 1.3,
				strokeDasharray: "4 4",
				opacity: 0.85,
				fill: "none",
			}}
		/>
	);
});
