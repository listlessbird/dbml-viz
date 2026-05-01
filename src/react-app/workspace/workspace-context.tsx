import { createContext, useContext } from "react";
import { useStore } from "zustand";

import type {
	WorkspaceState,
	WorkspaceStore,
} from "@/workspace/workspace-store";

export const WorkspaceContext = createContext<WorkspaceStore | null>(null);

export function useWorkspace<T>(
	selector: (state: WorkspaceState) => T,
): T {
	const store = useContext(WorkspaceContext);
	if (!store) {
		throw new Error("useWorkspace must be used inside WorkspaceProvider");
	}
	return useStore(store, selector);
}
