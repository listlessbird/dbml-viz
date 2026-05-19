import { createContext, useContext } from "react";
import { useStore } from "zustand";

import type {
	SourceFocusRequest,
	SourceFocusState,
	SourceFocusStore,
} from "@/canvas-next/source-focus/source-focus-store";

export const SourceFocusContext = createContext<SourceFocusStore | null>(null);

const EMPTY_STATE = Object.freeze({
	request: null,
}) as unknown as SourceFocusState;

const EMPTY_STORE: SourceFocusStore = {
	getState: () => EMPTY_STATE,
	setState: () => {},
	subscribe: () => () => {},
	getInitialState: () => EMPTY_STATE,
} as unknown as SourceFocusStore;

const selectRequest = (state: SourceFocusState) => state.request;

export function useSourceFocusStore(): SourceFocusStore {
	const store = useContext(SourceFocusContext);
	if (!store) {
		throw new Error(
			"useSourceFocusStore must be used inside SourceFocusProvider",
		);
	}
	return store;
}

export function useOptionalSourceFocusStore(): SourceFocusStore | null {
	return useContext(SourceFocusContext);
}

export function useSourceFocusRequest(): SourceFocusRequest | null {
	const store = useContext(SourceFocusContext) ?? EMPTY_STORE;
	return useStore(store, selectRequest);
}
