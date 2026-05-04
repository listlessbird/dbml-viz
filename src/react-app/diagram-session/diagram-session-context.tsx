import { createContext, useContext } from "react";
import type { XYPosition } from "@xyflow/react";
import { useStore } from "zustand";

import type {
	DiagramPositions,
	ParseDiagnostic,
	ParsedSchema,
	SchemaPayload,
	SharedStickyNote,
} from "@/types";
import type {
	DiagramSessionState,
	DiagramSessionStore,
} from "@/diagram-session/diagram-session-store";

export interface Diagram {
	readonly source: string;
	readonly parsedSchema: ParsedSchema;
	readonly tablePositions: DiagramPositions;
	readonly stickyNotes: readonly SharedStickyNote[];
}

export interface DiagramSession {
	readonly diagram: Diagram;
	readonly parseDiagnostics: readonly ParseDiagnostic[];
	readonly commitTablePositions: (
		positions: Readonly<Record<string, XYPosition>>,
	) => void;
	readonly toSchemaPayload: () => SchemaPayload;
}

export const DiagramSessionContext = createContext<DiagramSessionStore | null>(
	null,
);

export function useDiagramSession<T>(
	selector: (state: DiagramSessionState) => T,
): T {
	const store = useContext(DiagramSessionContext);
	if (!store) {
		throw new Error("useDiagramSession must be used inside DiagramSessionProvider");
	}
	return useStore(store, selector);
}

export function useDiagramSessionStore(): DiagramSessionStore {
	const store = useContext(DiagramSessionContext);
	if (!store) {
		throw new Error("useDiagramSessionStore must be used inside DiagramSessionProvider");
	}
	return store;
}
