import { createContext, useContext, useRef, type PropsWithChildren } from "react";

import {
	createDefaultDraftPersistenceAdapter,
	type DraftPersistenceAdapter,
} from "@/canvas-next/diagram-persistence-adapter";

const DraftPersistenceContext = createContext<DraftPersistenceAdapter | null>(null);

export interface DraftPersistenceProviderProps extends PropsWithChildren {
	readonly adapter?: DraftPersistenceAdapter;
}

export function DraftPersistenceProvider({
	adapter,
	children,
}: DraftPersistenceProviderProps) {
	const fallbackRef = useRef<DraftPersistenceAdapter | null>(null);
	const value =
		adapter ?? (fallbackRef.current ??= createDefaultDraftPersistenceAdapter());

	return (
		<DraftPersistenceContext value={value}>{children}</DraftPersistenceContext>
	);
}

export function useDraftPersistenceAdapter(): DraftPersistenceAdapter {
	const adapter = useContext(DraftPersistenceContext);
	if (!adapter) {
		throw new Error(
			"useDraftPersistenceAdapter must be used inside DraftPersistenceProvider",
		);
	}
	return adapter;
}
