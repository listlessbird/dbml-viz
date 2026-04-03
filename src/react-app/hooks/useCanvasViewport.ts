import { useCallback, useRef, useState } from "react";
import type { ReactFlowInstance, Viewport } from "@xyflow/react";

import type { DiagramEdge, DiagramNode } from "@/types";

export function useCanvasViewport() {
	const reactFlowRef = useRef<ReactFlowInstance<DiagramNode, DiagramEdge> | null>(
		null,
	);
	const [viewportZoom, setViewportZoom] = useState(1);

	const requestFitView = useCallback((nodeIds?: readonly string[]) => {
		const focusedIds =
			nodeIds && nodeIds.length > 0 ? Array.from(new Set(nodeIds)) : undefined;

		requestAnimationFrame(() => {
			const instance = reactFlowRef.current;
			if (!instance) {
				return;
			}

			void instance.fitView({
				padding: 0.16,
				duration: 500,
				nodes: focusedIds?.map((id) => ({ id })),
			});
		});
	}, []);

	const handleCanvasInit = useCallback(
		(instance: ReactFlowInstance<DiagramNode, DiagramEdge>) => {
			reactFlowRef.current = instance;
			setViewportZoom(instance.getZoom());
		},
		[],
	);

	const handleViewportChange = useCallback((viewport: Viewport) => {
		setViewportZoom(viewport.zoom);
	}, []);

	const handleZoomIn = useCallback(() => {
		void reactFlowRef.current?.zoomIn({ duration: 180 });
	}, []);

	const handleZoomOut = useCallback(() => {
		void reactFlowRef.current?.zoomOut({ duration: 180 });
	}, []);

	return {
		viewportZoom,
		requestFitView,
		handleCanvasInit,
		handleViewportChange,
		handleZoomIn,
		handleZoomOut,
	};
}
