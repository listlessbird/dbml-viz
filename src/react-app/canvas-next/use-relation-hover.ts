import { useCallback, useMemo } from "react";

import { useCanvasRuntime } from "@/canvas-next/canvas-runtime-context";
import type { CanvasNode } from "@/types";

export interface RelationHoverHandlers {
	readonly onNodeMouseEnter: (event: unknown, node: CanvasNode) => void;
	readonly onNodeMouseLeave: (event: unknown, node: CanvasNode) => void;
}

export function useRelationHoverHandlers(): RelationHoverHandlers {
	const setActiveRelationTableIds = useCanvasRuntime(
		(state) => state.setActiveRelationTableIds,
	);
	const clearActiveRelationTableIds = useCanvasRuntime(
		(state) => state.clearActiveRelationTableIds,
	);

	const onNodeMouseEnter = useCallback(
		(_event: unknown, node: CanvasNode) => {
			if (node.type !== "table") return;
			setActiveRelationTableIds([node.id]);
		},
		[setActiveRelationTableIds],
	);

	const onNodeMouseLeave = useCallback(
		(_event: unknown, node: CanvasNode) => {
			if (node.type !== "table") return;
			clearActiveRelationTableIds();
		},
		[clearActiveRelationTableIds],
	);

	return useMemo(
		() => ({ onNodeMouseEnter, onNodeMouseLeave }),
		[onNodeMouseEnter, onNodeMouseLeave],
	);
}
