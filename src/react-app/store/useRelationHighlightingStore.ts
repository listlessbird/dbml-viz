import { create } from "zustand";

interface RelationHighlightingState {
	activeTableIds: Set<string>;
	activeRelationColumnsByTable: Map<string, Set<string>>;
	setActiveElements: (tables: Set<string>, columns: Map<string, Set<string>>) => void;
}

export const useRelationHighlightingStore = create<RelationHighlightingState>((set) => ({
	activeTableIds: new Set(),
	activeRelationColumnsByTable: new Map(),
	setActiveElements: (activeTableIds, activeRelationColumnsByTable) =>
		set({ activeTableIds, activeRelationColumnsByTable }),
}));
