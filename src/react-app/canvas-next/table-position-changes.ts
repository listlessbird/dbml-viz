import type { NodeChange, XYPosition } from "@xyflow/react";

import type { CanvasNode, DiagramPositions } from "@/types";

const isFinitePosition = (
	position: XYPosition | undefined,
): position is XYPosition =>
	position !== undefined &&
	Number.isFinite(position.x) &&
	Number.isFinite(position.y);

export function collectTablePositionChanges(
	changes: readonly NodeChange<CanvasNode>[],
	tableIds: ReadonlySet<string>,
): DiagramPositions {
	const positions: DiagramPositions = {};

	for (const change of changes) {
		if (change.type !== "position") continue;
		if (!tableIds.has(change.id)) continue;
		if (!isFinitePosition(change.position)) continue;

		positions[change.id] = {
			x: change.position.x,
			y: change.position.y,
		};
	}

	return positions;
}
