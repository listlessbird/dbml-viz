import type { ReactFlowInstance, Viewport } from "@xyflow/react";
import { createStore, type StoreApi } from "zustand/vanilla";

import type { CanvasEdge, CanvasNode } from "@/types";

export const defaultViewport: Viewport = Object.freeze({ x: 0, y: 0, zoom: 1 });
export const TEMPORARY_CURSOR_NODE_ID = "canvas-runtime:temporary-cursor";
export const TEMPORARY_RELATIONSHIP_EDGE_ID =
	"canvas-runtime:temporary-relationship";

const fitViewOptions = Object.freeze({
	padding: 0.16,
	duration: 500,
});

const normalizeTableIds = (tableIds: readonly string[]) =>
	Array.from(new Set(tableIds));

export interface TemporaryRelationshipPreview {
	readonly kind: "relationship-preview";
	readonly sourceTableId: string;
	readonly targetTableId: string | null;
	readonly cursorPosition: { readonly x: number; readonly y: number } | null;
}

export interface ProjectionRuntimeState {
	readonly activeRelationTableIds: readonly string[];
	readonly temporaryRelationship: TemporaryRelationshipPreview | null;
}

export interface CanvasRuntimeState extends ProjectionRuntimeState {
	readonly flowInstance: ReactFlowInstance<CanvasNode, CanvasEdge> | null;
	readonly viewport: Viewport;
	readonly focusTableIds: readonly string[];
	readonly attachReactFlowInstance: (
		instance: ReactFlowInstance<CanvasNode, CanvasEdge>,
	) => void;
	readonly detachReactFlowInstance: () => void;
	readonly setViewport: (viewport: Viewport) => void;
	readonly requestFocus: (tableIds: readonly string[]) => void;
	readonly clearFocus: () => void;
	readonly requestFitView: (tableIds?: readonly string[]) => void;
	readonly cancelFitView: () => void;
	readonly setActiveRelationTableIds: (tableIds: readonly string[]) => void;
	readonly clearActiveRelationTableIds: () => void;
	readonly startTemporaryRelationship: (input: {
		readonly sourceTableId: string;
	}) => void;
	readonly updateTemporaryRelationshipCursor: (position: {
		readonly x: number;
		readonly y: number;
	}) => void;
	readonly setTemporaryRelationshipTarget: (tableId: string | null) => void;
	readonly cancelTemporaryRelationship: () => void;
	readonly clearTemporaryObjects: () => void;
	readonly dispose: () => void;
}

export type CanvasRuntimeStore = StoreApi<CanvasRuntimeState>;

export function createCanvasRuntimeStore(): CanvasRuntimeStore {
	let pendingFitViewFrameId: number | null = null;

	const cancelPendingFitView = () => {
		if (pendingFitViewFrameId === null) return;
		cancelAnimationFrame(pendingFitViewFrameId);
		pendingFitViewFrameId = null;
	};

	return createStore<CanvasRuntimeState>()((set, get) => ({
		flowInstance: null,
		viewport: defaultViewport,
		focusTableIds: [],
		activeRelationTableIds: [],
		temporaryRelationship: null,
		attachReactFlowInstance: (flowInstance) => {
			set({ flowInstance });
		},
		detachReactFlowInstance: () => {
			cancelPendingFitView();
			set({ flowInstance: null });
		},
		setViewport: (viewport) => {
			set({ viewport });
		},
		requestFocus: (tableIds) => {
			const focusTableIds = normalizeTableIds(tableIds);
			set({ focusTableIds });
			get().requestFitView(focusTableIds);
		},
		clearFocus: () => {
			set({ focusTableIds: [] });
		},
		requestFitView: (tableIds) => {
			cancelPendingFitView();
			const focusedIds =
				tableIds && tableIds.length > 0
					? normalizeTableIds(tableIds)
					: undefined;
			pendingFitViewFrameId = requestAnimationFrame(() => {
				pendingFitViewFrameId = null;
				const instance = get().flowInstance;
				if (!instance) return;
				void instance.fitView({
					...fitViewOptions,
					nodes: focusedIds?.map((id) => ({ id })),
				});
			});
		},
		cancelFitView: () => {
			cancelPendingFitView();
		},
		setActiveRelationTableIds: (tableIds) => {
			set({ activeRelationTableIds: normalizeTableIds(tableIds) });
		},
		clearActiveRelationTableIds: () => {
			set({ activeRelationTableIds: [] });
		},
		startTemporaryRelationship: ({ sourceTableId }) => {
			set({
				temporaryRelationship: {
					kind: "relationship-preview",
					sourceTableId,
					targetTableId: null,
					cursorPosition: null,
				},
			});
		},
		updateTemporaryRelationshipCursor: (cursorPosition) => {
			set((state) => {
				if (!state.temporaryRelationship) return state;
				return {
					temporaryRelationship: {
						...state.temporaryRelationship,
						cursorPosition,
					},
				};
			});
		},
		setTemporaryRelationshipTarget: (targetTableId) => {
			set((state) => {
				if (!state.temporaryRelationship) return state;
				return {
					temporaryRelationship: {
						...state.temporaryRelationship,
						targetTableId,
					},
				};
			});
		},
		cancelTemporaryRelationship: () => {
			set({ temporaryRelationship: null });
		},
		clearTemporaryObjects: () => {
			set({ temporaryRelationship: null });
		},
		dispose: () => {
			cancelPendingFitView();
			set({
				flowInstance: null,
				viewport: defaultViewport,
				focusTableIds: [],
				activeRelationTableIds: [],
				temporaryRelationship: null,
			});
		},
	}));
}
