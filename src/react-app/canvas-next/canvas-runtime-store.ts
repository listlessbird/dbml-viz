import type { ReactFlowInstance, Viewport } from "@xyflow/react";
import { subscribeWithSelector } from "zustand/middleware";
import { createStore, type StoreApi } from "zustand/vanilla";

import type { SchemaSearchResult } from "@/schema-model/schema-search";
import type { CanvasEdge, CanvasNode } from "@/types";

const defaultViewport: Viewport = Object.freeze({ x: 0, y: 0, zoom: 1 });
export const TEMPORARY_CURSOR_NODE_ID = "canvas-runtime:temporary-cursor";
export const TEMPORARY_RELATIONSHIP_EDGE_ID =
	"canvas-runtime:temporary-relationship";

const fitViewOptions = Object.freeze({
	padding: 0.16,
	duration: 500,
});

interface TemporaryRelationshipPreview {
	readonly kind: "relationship-preview";
	readonly sourceTableId: string;
	readonly targetTableId: string | null;
	readonly cursorPosition: { readonly x: number; readonly y: number } | null;
}

export interface ProjectionRuntimeState {
	readonly selectedRelationshipId: string | null;
	readonly temporaryRelationship: TemporaryRelationshipPreview | null;
	readonly searchHighlight?: SchemaSearchResult | null;
}

export interface CanvasRuntimeState extends ProjectionRuntimeState {
	readonly flowInstance: ReactFlowInstance<CanvasNode, CanvasEdge> | null;
	readonly viewport: Viewport;
	readonly focusTableIds: readonly string[];
	readonly isLayoutPending: boolean;
	readonly withLayoutPending: <T>(operation: () => Promise<T>) => Promise<T>;
	readonly attachReactFlowInstance: (
		instance: ReactFlowInstance<CanvasNode, CanvasEdge>,
	) => void;
	readonly detachReactFlowInstance: () => void;
	readonly setViewport: (viewport: Viewport) => void;
	readonly requestFocus: (tableIds: readonly string[]) => void;
	readonly clearFocus: () => void;
	readonly requestFitView: (tableIds?: readonly string[]) => void;
	readonly cancelFitView: () => void;
	readonly selectRelationship: (relationshipId: string) => void;
	readonly clearRelationshipSelection: () => void;
	readonly setSearchHighlight: (highlight: SchemaSearchResult | null) => void;
	readonly clearSearchHighlight: () => void;
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

type SelectorSubscribe = <U>(
	selector: (state: CanvasRuntimeState) => U,
	listener: (selected: U, previous: U) => void,
	options?: {
		readonly equalityFn?: (a: U, b: U) => boolean;
		readonly fireImmediately?: boolean;
	},
) => () => void;

export type CanvasRuntimeStore = StoreApi<CanvasRuntimeState> & {
	readonly subscribe: SelectorSubscribe & StoreApi<CanvasRuntimeState>["subscribe"];
};

export function createCanvasRuntimeStore(): CanvasRuntimeStore {
	let pendingFitViewFrameId: number | null = null;
	let layoutPendingDepth = 0;

	const cancelPendingFitView = () => {
		if (pendingFitViewFrameId === null) return;
		cancelAnimationFrame(pendingFitViewFrameId);
		pendingFitViewFrameId = null;
	};

	return createStore<CanvasRuntimeState>()(subscribeWithSelector((set, get) => ({
		flowInstance: null,
		viewport: defaultViewport,
		focusTableIds: [],
		selectedRelationshipId: null,
		temporaryRelationship: null,
		searchHighlight: null,
		isLayoutPending: false,
		withLayoutPending: async (operation) => {
			layoutPendingDepth += 1;
			if (layoutPendingDepth === 1) {
				set({ isLayoutPending: true });
			}
			try {
				return await operation();
			} finally {
				layoutPendingDepth = Math.max(0, layoutPendingDepth - 1);
				if (layoutPendingDepth === 0) {
					set({ isLayoutPending: false });
				}
			}
		},
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
			const focusTableIds = Array.from(new Set(tableIds));
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
					? Array.from(new Set(tableIds))
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
		selectRelationship: (selectedRelationshipId) => {
			set((state) =>
				state.selectedRelationshipId === selectedRelationshipId
					? state
					: { selectedRelationshipId },
			);
		},
		clearRelationshipSelection: () => {
			set((state) =>
				state.selectedRelationshipId === null
					? state
					: { selectedRelationshipId: null },
			);
		},
		setSearchHighlight: (highlight) => {
			set({ searchHighlight: highlight });
		},
		clearSearchHighlight: () => {
			set({ searchHighlight: null });
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
			layoutPendingDepth = 0;
			set({
				flowInstance: null,
				viewport: defaultViewport,
				focusTableIds: [],
				selectedRelationshipId: null,
				temporaryRelationship: null,
				searchHighlight: null,
				isLayoutPending: false,
			});
		},
	}))) as CanvasRuntimeStore;
}
