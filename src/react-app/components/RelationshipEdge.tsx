import {
	BaseEdge,
	EdgeLabelRenderer,
	getSmoothStepPath,
	type EdgeProps,
} from "@xyflow/react";
import { memo } from "react";

import type { DiagramEdge } from "@/types";

export const RelationshipEdge = memo(function RelationshipEdge({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	markerEnd,
	style,
	label,
	data,
}: EdgeProps<DiagramEdge>) {
	const [edgePath, labelX, labelY] = getSmoothStepPath({
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
	});

	const relationBadge = typeof label === "string" ? label : data?.relationText;
	const relationSummary =
		data === undefined
			? null
			: `${data.from.table} -> ${data.to.table}`;
	const relationDetail =
		data === undefined
			? null
			: `${data.from.table}.${data.from.column} references ${data.to.table}.${data.to.column}`;
	const relationText = data?.relationText ?? null;
	const nativeTooltip =
		relationSummary && relationDetail && relationText
			? `${relationSummary}\n${relationDetail}\n${relationText}`
			: undefined;
	const badgeClassName = data?.isSearchDimmed
		? "border border-border bg-background/85 px-2 py-1 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground shadow-[0_8px_18px_color-mix(in_oklab,var(--foreground)_8%,transparent)] opacity-55"
		: data?.isSearchMatch
			? "border border-primary/40 bg-background px-2 py-1 text-[10px] font-semibold tracking-[0.16em] text-foreground shadow-[0_10px_22px_color-mix(in_oklab,var(--primary)_18%,transparent)]"
			: "border border-border bg-background px-2 py-1 text-[10px] font-semibold tracking-[0.16em] text-foreground shadow-[0_8px_18px_color-mix(in_oklab,var(--foreground)_12%,transparent)]";

	return (
		<>
			<BaseEdge
				id={id}
				path={edgePath}
				style={style}
				markerEnd={markerEnd}
				interactionWidth={20}
			/>
			<EdgeLabelRenderer>
				<div
					className="pointer-events-none absolute flex flex-col items-center"
					style={{
						transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
					}}
				>
					{relationBadge ? (
						<div
							className={`pointer-events-auto cursor-help ${badgeClassName}`}
							title={nativeTooltip}
						>
							{relationBadge}
						</div>
					) : null}
				</div>
			</EdgeLabelRenderer>
		</>
	);
});
