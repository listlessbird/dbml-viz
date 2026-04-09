import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { DiagramGridMode, DiagramLayoutAlgorithm } from "@/types";

const normalizeTableIds = (tableIds: readonly string[]) =>
	Array.from(new Set(tableIds)).sort();

const areTableIdListsEqual = (
	current: readonly string[],
	next: readonly string[],
) => current.length === next.length && current.every((id, index) => id === next[index]);

interface DiagramUiState {
	readonly gridMode: DiagramGridMode;
	readonly panModeEnabled: boolean;
	readonly layoutAlgorithm: DiagramLayoutAlgorithm;
	readonly searchQuery: string;
	readonly focusedTableIds: readonly string[];
	readonly selectedTableIds: readonly string[];
	readonly setGridMode: (gridMode: DiagramGridMode) => void;
	readonly setPanModeEnabled: (panModeEnabled: boolean) => void;
	readonly togglePanMode: () => void;
	readonly setLayoutAlgorithm: (layoutAlgorithm: DiagramLayoutAlgorithm) => void;
	readonly setSearchQuery: (searchQuery: string) => void;
	readonly setFocusedTableIds: (tableIds: readonly string[]) => void;
	readonly clearFocusedTableIds: () => void;
	readonly setSelectedTableIds: (tableIds: readonly string[]) => void;
	readonly clearSelectedTableIds: () => void;
}

export const useDiagramUiStore = create<DiagramUiState>()(
	persist(
		(set) => ({
			gridMode: "dots",
			panModeEnabled: false,
			layoutAlgorithm: "left-right",
			searchQuery: "",
			focusedTableIds: [],
			selectedTableIds: [],
			setGridMode: (gridMode) => {
				set({ gridMode });
			},
			setPanModeEnabled: (panModeEnabled) => {
				set({ panModeEnabled });
			},
			togglePanMode: () => {
				set((state) => ({ panModeEnabled: !state.panModeEnabled }));
			},
			setLayoutAlgorithm: (layoutAlgorithm) => {
				set({ layoutAlgorithm });
			},
			setSearchQuery: (searchQuery) => {
				set({ searchQuery });
			},
			setFocusedTableIds: (tableIds) => {
				const nextTableIds = normalizeTableIds(tableIds);
				set((state) =>
					areTableIdListsEqual(state.focusedTableIds, nextTableIds)
						? state
						: { focusedTableIds: nextTableIds },
				);
			},
			clearFocusedTableIds: () => {
				set((state) =>
					state.focusedTableIds.length === 0 ? state : { focusedTableIds: [] },
				);
			},
			setSelectedTableIds: (tableIds) => {
				const nextTableIds = normalizeTableIds(tableIds);
				set((state) =>
					areTableIdListsEqual(state.selectedTableIds, nextTableIds)
						? state
						: { selectedTableIds: nextTableIds },
				);
			},
			clearSelectedTableIds: () => {
				set((state) =>
					state.selectedTableIds.length === 0 ? state : { selectedTableIds: [] },
				);
			},
		}),
		{
			name: "dbml-visualizer-ui",
			storage: createJSONStorage(() => localStorage),
			partialize: (state) => ({
				gridMode: state.gridMode,
				panModeEnabled: state.panModeEnabled,
				layoutAlgorithm: state.layoutAlgorithm,
			}),
		},
	),
);
