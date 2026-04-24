import {
	BaseEdge,
	EdgeLabelRenderer,
	getSmoothStepPath,
	useStore,
	type EdgeProps,
} from "@xyflow/react";
import { memo, useMemo } from "react";

import { sampleEdgeLabelPosition } from "@/lib/edge-label";
import { formatRefEndpointSummary } from "@/lib/schema-format";
import { useRelationHighlightingStore } from "@/store/useRelationHighlightingStore";
import type { DiagramEdge } from "@/types";


const RELATION_PARTICLE_DURATION = 1.36;
const RELATION_PARTICLE_OFFSETS = [0, -0.34, -0.68, -1.02] as const;

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
	const [edgePath] = getSmoothStepPath({
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
	});

	// Sample a point on the actual SVG path near the target end (where the
	// arrow is) so the label always sits on the drawn edge, close to a table.
	const labelPoint = useMemo(() => sampleEdgeLabelPosition(edgePath, 40), [edgePath]);
	const labelX = labelPoint.x;
	const labelY = labelPoint.y;

	const relationBadge = typeof label === "string" ? label : data?.relationText;
	const relationSummary =
		data === undefined
			? null
			: `${data.from.table} -> ${data.to.table}`;
	const relationDetail =
		data === undefined ? null : formatRefEndpointSummary(data.from, data.to);
	const relationText = data?.relationText ?? null;
	const nativeTooltip = data
		? [
				relationSummary,
				relationDetail,
				relationText,
				data.name ? `constraint ${data.name}` : null,
				data.onDelete ? `on delete ${data.onDelete}` : null,
				data.onUpdate ? `on update ${data.onUpdate}` : null,
			]
				.filter(Boolean)
				.join("\n")
		: undefined;
	const isRelationActive = useRelationHighlightingStore(
		(state) => data && (state.activeTableIds.has(data.from.table) || state.activeTableIds.has(data.to.table)),
	);
	const isLargeGraph = useStore((s) => s.edges.length > 150);
	const isLabelVisible = relationBadge && (isRelationActive || !isLargeGraph);
	const strokeWidth =
		typeof style?.strokeWidth === "number"
			? style.strokeWidth
			: typeof style?.strokeWidth === "string"
				? Number(style.strokeWidth)
				: 1.4;
	const badgeClassName = isRelationActive
		? "pointer-events-auto cursor-help border border-primary/55 bg-background px-2 py-1 text-[10px] font-semibold tracking-[0.16em] text-foreground shadow-[0_12px_28px_color-mix(in_oklab,var(--primary)_22%,transparent)] transition-[border-color,box-shadow,transform,opacity] duration-200 ease-out"
		: data?.isSearchDimmed
			? "pointer-events-auto cursor-help border border-border bg-background/85 px-2 py-1 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground shadow-[0_8px_18px_color-mix(in_oklab,var(--foreground)_8%,transparent)] opacity-55 transition-[border-color,box-shadow,transform,opacity] duration-200 ease-out"
			: data?.isSearchMatch
				? "pointer-events-auto cursor-help border border-primary/40 bg-background px-2 py-1 text-[10px] font-semibold tracking-[0.16em] text-foreground shadow-[0_10px_22px_color-mix(in_oklab,var(--primary)_18%,transparent)] transition-[border-color,box-shadow,transform,opacity] duration-200 ease-out"
				: "pointer-events-auto cursor-help border border-border bg-background px-2 py-1 text-[10px] font-semibold tracking-[0.16em] text-foreground shadow-[0_8px_18px_color-mix(in_oklab,var(--foreground)_12%,transparent)] transition-[border-color,box-shadow,transform,opacity] duration-200 ease-out";

	return (
		<>
			{isRelationActive ? (
				<g aria-hidden="true">
					<path
						d={edgePath}
						fill="none"
						className="relation-edge-highlight animate-in fade-in duration-200"
						style={{
							stroke: "color-mix(in oklab, var(--primary) 28%, transparent)",
							strokeWidth: strokeWidth + 3.4,
							opacity: 0.44,
						}}
					/>
					{RELATION_PARTICLE_OFFSETS.map((begin) => (
						<rect
							key={`${id}-particle-${begin}`}
							x={-6}
							y={-2.4}
							width={12}
							height={4.8}
							rx={1.9}
							className="relation-edge-particle"
							fill="var(--primary)"
							stroke="color-mix(in oklab, var(--background) 78%, transparent)"
							strokeWidth={0.8}
						>
							<animateMotion
								begin={`${begin}s`}
								dur={`${RELATION_PARTICLE_DURATION}s`}
								path={edgePath}
								repeatCount="indefinite"
								rotate="auto"
							/>
							<animate
								attributeName="opacity"
								values="0.28;1;1;0.28"
								keyTimes="0;0.12;0.88;1"
								dur={`${RELATION_PARTICLE_DURATION}s`}
								begin={`${begin}s`}
								repeatCount="indefinite"
							/>
						</rect>
					))}
				</g>
			) : null}
			<BaseEdge
				id={id}
				path={edgePath}
				style={{
					...style,
					strokeWidth: isRelationActive ? strokeWidth + 0.9 : strokeWidth,
					stroke: isRelationActive ? "var(--primary)" : style?.stroke,
				}}
				markerEnd={markerEnd}
				interactionWidth={20}
			/>
			{isLabelVisible ? (
				<EdgeLabelRenderer>
					<div
						className="pointer-events-none absolute flex flex-col items-center"
						style={{
							transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
						}}
					>
						<div
							className={badgeClassName}
							title={nativeTooltip}
						>
							{relationBadge}
						</div>
					</div>
				</EdgeLabelRenderer>
			) : null}
		</>
	);
});
