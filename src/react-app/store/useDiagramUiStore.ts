import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { DiagramGridMode, DiagramLayoutAlgorithm } from "@/types";

interface DiagramUiState {
	readonly gridMode: DiagramGridMode;
	readonly layoutAlgorithm: DiagramLayoutAlgorithm;
	readonly searchQuery: string;
	readonly setGridMode: (gridMode: DiagramGridMode) => void;
	readonly setLayoutAlgorithm: (layoutAlgorithm: DiagramLayoutAlgorithm) => void;
	readonly setSearchQuery: (searchQuery: string) => void;
}

export const useDiagramUiStore = create<DiagramUiState>()(
	persist(
		(set) => ({
			gridMode: "dots",
			layoutAlgorithm: "left-right",
			searchQuery: "",
			setGridMode: (gridMode) => {
				set({ gridMode });
			},
			setLayoutAlgorithm: (layoutAlgorithm) => {
				set({ layoutAlgorithm });
			},
			setSearchQuery: (searchQuery) => {
				set({ searchQuery });
			},
		}),
		{
			name: "dbml-visualizer-ui",
			storage: createJSONStorage(() => localStorage),
			partialize: (state) => ({
				gridMode: state.gridMode,
				layoutAlgorithm: state.layoutAlgorithm,
			}),
		},
	),
);
