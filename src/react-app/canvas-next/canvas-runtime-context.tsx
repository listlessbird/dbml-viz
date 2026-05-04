import { createContext, useContext } from "react";
import { useStore } from "zustand";

import type {
	CanvasRuntimeState,
	CanvasRuntimeStore,
} from "@/canvas-next/canvas-runtime-store";

export const CanvasRuntimeContext = createContext<CanvasRuntimeStore | null>(null);

export function useCanvasRuntime<T>(
	selector: (state: CanvasRuntimeState) => T,
): T {
	const store = useContext(CanvasRuntimeContext);
	if (!store) {
		throw new Error("useCanvasRuntime must be used inside CanvasRuntimeProvider");
	}
	return useStore(store, selector);
}

export function useCanvasRuntimeStore(): CanvasRuntimeStore {
	const store = useContext(CanvasRuntimeContext);
	if (!store) {
		throw new Error("useCanvasRuntimeStore must be used inside CanvasRuntimeProvider");
	}
	return store;
}
