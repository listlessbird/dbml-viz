import { subscribeWithSelector } from "zustand/middleware";
import { createStore, type StoreApi } from "zustand/vanilla";

export interface SourceFocusRequest {
	readonly id: number;
	readonly tableName: string;
	readonly columnName: string | null;
}

export interface SourceFocusState {
	readonly request: SourceFocusRequest | null;
	readonly requestSourceFocus: (input: {
		readonly tableName: string;
		readonly columnName?: string;
	}) => void;
	readonly consumeRequest: () => void;
	readonly dispose: () => void;
}

type SelectorSubscribe = <U>(
	selector: (state: SourceFocusState) => U,
	listener: (selected: U, previous: U) => void,
	options?: {
		readonly equalityFn?: (a: U, b: U) => boolean;
		readonly fireImmediately?: boolean;
	},
) => () => void;

export type SourceFocusStore = StoreApi<SourceFocusState> & {
	readonly subscribe: SelectorSubscribe & StoreApi<SourceFocusState>["subscribe"];
};

export function createSourceFocusStore(): SourceFocusStore {
	let nextId = 1;

	return createStore<SourceFocusState>()(
		subscribeWithSelector((set) => ({
			request: null,
			requestSourceFocus: ({ tableName, columnName }) => {
				if (tableName.length === 0) return;
				set({
					request: {
						id: nextId++,
						tableName,
						columnName: columnName ?? null,
					},
				});
			},
			consumeRequest: () => {
				set((state) => (state.request === null ? state : { request: null }));
			},
			dispose: () => {
				set({ request: null });
			},
		})),
	) as SourceFocusStore;
}
