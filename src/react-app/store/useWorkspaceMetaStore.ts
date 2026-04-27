import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface WorkspaceMetaState {
	readonly lastServerUpdatedAt: number | null;
	readonly setLastServerUpdatedAt: (value: number) => void;
	readonly clearLastServerUpdatedAt: () => void;
}

export const useWorkspaceMetaStore = create<WorkspaceMetaState>()(
	persist(
		(set) => ({
			lastServerUpdatedAt: null,
			setLastServerUpdatedAt: (value) => set({ lastServerUpdatedAt: value }),
			clearLastServerUpdatedAt: () => set({ lastServerUpdatedAt: null }),
		}),
		{
			name: "dbml-visualizer-workspace-meta",
			storage: createJSONStorage(() => localStorage),
			partialize: (state) => ({
				lastServerUpdatedAt: state.lastServerUpdatedAt,
			}),
		},
	),
);
