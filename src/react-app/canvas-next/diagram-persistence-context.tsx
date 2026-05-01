import { createContext, useContext, useRef, type PropsWithChildren } from "react";

import {
	type DiagramPersistenceAdapter,
	type DraftPersistenceAdapter,
	withSharePersistenceAdapter,
} from "@/canvas-next/diagram-persistence-adapter";

const DiagramPersistenceContext =
	createContext<DiagramPersistenceAdapter | null>(null);

export interface DraftPersistenceProviderProps extends PropsWithChildren {
	readonly adapter?: DraftPersistenceAdapter | DiagramPersistenceAdapter;
}

export function DraftPersistenceProvider({
	adapter,
	children,
}: DraftPersistenceProviderProps) {
	const valueRef = useRef<DiagramPersistenceAdapter | null>(null);
	valueRef.current ??= withSharePersistenceAdapter(adapter);

	return (
		<DiagramPersistenceContext value={valueRef.current}>
			{children}
		</DiagramPersistenceContext>
	);
}

export function useDraftPersistenceAdapter(): DraftPersistenceAdapter {
	const adapter = useContext(DiagramPersistenceContext);
	if (!adapter) {
		throw new Error(
			"useDraftPersistenceAdapter must be used inside DraftPersistenceProvider",
		);
	}
	return adapter;
}

export function useDiagramPersistenceAdapter(): DiagramPersistenceAdapter {
	const adapter = useContext(DiagramPersistenceContext);
	if (!adapter) {
		throw new Error(
			"useDiagramPersistenceAdapter must be used inside DraftPersistenceProvider",
		);
	}
	return adapter;
}
