import {
	BaseEdge,
	EdgeLabelRenderer,
	getSmoothStepPath,
	useReactFlow,
	type EdgeProps,
} from "@xyflow/react";
import { memo, useCallback, useMemo, useState } from "react";

import type { CanvasEdge, CanvasNode, DiagramEdge, RefEndpointData } from "@/types";

type BadgeVisibility = "measuring" | "visible" | "hidden";

const formatEndpoint = (endpoint: RefEndpointData) =>
	`${endpoint.table}.${endpoint.columns.join(", ")}`;

const metadataParts = (data: NonNullable<DiagramEdge["data"]>) =>
	[
		data.relationText,
		data.name ? `constraint ${data.name}` : null,
		data.onDelete ? `on delete ${data.onDelete}` : null,
		data.onUpdate ? `on update ${data.onUpdate}` : null,
	].filter((part): part is string => part !== null);

function SelectedRelationshipBadge({
	data,
	labelX,
	labelY,
	source,
	sourceX,
	target,
	targetX,
}: {
	readonly data: NonNullable<DiagramEdge["data"]>;
	readonly labelX: number;
	readonly labelY: number;
	readonly source: string;
	readonly sourceX: number;
	readonly target: string;
	readonly targetX: number;
}) {
	const reactFlow = useReactFlow<CanvasNode, CanvasEdge>();
	const [visibility, setVisibility] = useState<BadgeVisibility>("measuring");
	const sourceEndpoint = formatEndpoint(data.from);
	const targetEndpoint = formatEndpoint(data.to);
	const leftToRight = sourceX < targetX;
	const firstEndpoint = leftToRight ? sourceEndpoint : targetEndpoint;
	const secondEndpoint = leftToRight ? targetEndpoint : sourceEndpoint;
	const direction = leftToRight ? "→" : "←";
	const details = useMemo(() => metadataParts(data), [data]);
	const measureBadge = useCallback((badge: HTMLDivElement | null) => {
		if (!badge) return;
		const sourceNode = reactFlow.getNode(source);
		const targetNode = reactFlow.getNode(target);
		if (!sourceNode || !targetNode) {
			setVisibility("hidden");
			return;
		}

		const rect = badge.getBoundingClientRect();
		const origin = reactFlow.screenToFlowPosition({ x: rect.x, y: rect.y });
		const end = reactFlow.screenToFlowPosition({
			x: rect.x + rect.width,
			y: rect.y + rect.height,
		});
		const badgeRect = {
			x: origin.x,
			y: origin.y,
			width: end.x - origin.x,
			height: end.y - origin.y,
		};
		const intersectsSource = reactFlow.isNodeIntersecting(sourceNode, badgeRect);
		const intersectsTarget = reactFlow.isNodeIntersecting(targetNode, badgeRect);
		const shouldShow = !intersectsSource && !intersectsTarget;

		setVisibility((current) => {
			const next: BadgeVisibility = shouldShow ? "visible" : "hidden";
			return current === next ? current : next;
		});
	}, [reactFlow, source, target]);

	if (visibility === "hidden") return null;

	return (
		<EdgeLabelRenderer>
			<div
				ref={measureBadge}
				data-testid="relationship-detail-badge"
				className="nodrag nopan pointer-events-auto absolute z-50 border border-primary/70 bg-background px-2.5 py-2 text-[11px] text-foreground shadow-[0_14px_30px_color-mix(in_oklab,var(--primary)_26%,transparent)]"
				style={{
					transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
					visibility: visibility === "measuring" ? "hidden" : "visible",
				}}
			>
				<div className="flex items-center gap-2 font-semibold">
					<span>{firstEndpoint}</span>
					<span aria-hidden="true">{direction}</span>
					<span>{secondEndpoint}</span>
				</div>
				<div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
					{details.map((detail) => (
						<span key={detail}>{detail}</span>
					))}
				</div>
			</div>
		</EdgeLabelRenderer>
	);
}

export const RelationshipEdge = memo(function RelationshipEdge({
	id,
	source,
	sourceX,
	sourceY,
	target,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	markerEnd,
	style,
	data,
	selected,
}: EdgeProps<DiagramEdge>) {
	const [edgePath, labelX, labelY] = getSmoothStepPath({
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
	});
	const isSelected = selected || data?.isSelected === true;

	return (
		<>
			<BaseEdge
				id={id}
				path={edgePath}
				style={style}
				markerEnd={markerEnd}
				interactionWidth={20}
			/>
			{isSelected && data ? (
				<SelectedRelationshipBadge
					key={`${id}:${labelX}:${labelY}:${source}:${target}`}
					data={data}
					labelX={labelX}
					labelY={labelY}
					source={source}
					sourceX={sourceX}
					target={target}
					targetX={targetX}
				/>
			) : null}
		</>
	);
});
