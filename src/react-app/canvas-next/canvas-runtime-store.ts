import type { ReactFlowInstance, Viewport } from "@xyflow/react";
import { createStore, type StoreApi } from "zustand/vanilla";

import type { CanvasEdge, CanvasNode } from "@/types";

export const defaultViewport: Viewport = Object.freeze({ x: 0, y: 0, zoom: 1 });

const normalizeTableIds = (tableIds: readonly string[]) =>
	Array.from(new Set(tableIds));

export interface ProjectionRuntimeState {
	readonly focusTableIds: readonly string[];
	readonly activeRelationTableIds: readonly string[];
}

export interface CanvasRuntimeState extends ProjectionRuntimeState {
	readonly flowInstance: ReactFlowInstance<CanvasNode, CanvasEdge> | null;
	readonly viewport: Viewport;
	readonly attachReactFlowInstance: (
		instance: ReactFlowInstance<CanvasNode, CanvasEdge>,
	) => void;
	readonly detachReactFlowInstance: () => void;
	readonly setViewport: (viewport: Viewport) => void;
	readonly requestFocus: (tableIds: readonly string[]) => void;
	readonly clearFocus: () => void;
	readonly setActiveRelationTableIds: (tableIds: readonly string[]) => void;
	readonly clearActiveRelationTableIds: () => void;
	readonly dispose: () => void;
}

export type CanvasRuntimeStore = StoreApi<CanvasRuntimeState>;

export function createCanvasRuntimeStore(): CanvasRuntimeStore {
	return createStore<CanvasRuntimeState>()((set) => ({
		flowInstance: null,
		viewport: defaultViewport,
		focusTableIds: [],
		activeRelationTableIds: [],
		attachReactFlowInstance: (flowInstance) => {
			set({ flowInstance });
		},
		detachReactFlowInstance: () => {
			set({ flowInstance: null });
		},
		setViewport: (viewport) => {
			set({ viewport });
		},
		requestFocus: (tableIds) => {
			set({ focusTableIds: normalizeTableIds(tableIds) });
		},
		clearFocus: () => {
			set({ focusTableIds: [] });
		},
		setActiveRelationTableIds: (tableIds) => {
			set({ activeRelationTableIds: normalizeTableIds(tableIds) });
		},
		clearActiveRelationTableIds: () => {
			set({ activeRelationTableIds: [] });
		},
		dispose: () => {
			set({
				flowInstance: null,
				viewport: defaultViewport,
				focusTableIds: [],
				activeRelationTableIds: [],
			});
		},
	}));
}
