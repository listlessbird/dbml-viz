import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactFlowInstance, Viewport } from "@xyflow/react";

import type { DiagramEdge, DiagramNode } from "@/types";

export function useCanvasViewport() {
	const reactFlowRef = useRef<ReactFlowInstance<DiagramNode, DiagramEdge> | null>(
		null,
	);
	const zoomFrameRef = useRef<number | null>(null);
	const pendingZoomRef = useRef(1);
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
			const zoom = instance.getZoom();
			pendingZoomRef.current = zoom;
			setViewportZoom(zoom);
		},
		[],
	);

	const handleViewportChange = useCallback((viewport: Viewport) => {
		pendingZoomRef.current = viewport.zoom;
		if (zoomFrameRef.current !== null) {
			return;
		}

		zoomFrameRef.current = requestAnimationFrame(() => {
			zoomFrameRef.current = null;
			const nextZoom = pendingZoomRef.current;
			setViewportZoom((currentZoom) =>
				Math.abs(currentZoom - nextZoom) < 0.005 ? currentZoom : nextZoom,
			);
		});
	}, []);

	const handleZoomIn = useCallback(() => {
		void reactFlowRef.current?.zoomIn({ duration: 180 });
	}, []);

	const handleZoomOut = useCallback(() => {
		void reactFlowRef.current?.zoomOut({ duration: 180 });
	}, []);

	useEffect(
		() => () => {
			if (zoomFrameRef.current !== null) {
				cancelAnimationFrame(zoomFrameRef.current);
			}
		},
		[],
	);

	return {
		viewportZoom,
		requestFitView,
		handleCanvasInit,
		handleViewportChange,
		handleZoomIn,
		handleZoomOut,
	};
}
