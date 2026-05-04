import { useRef, type PropsWithChildren } from "react";

import type { Diagram } from "@/diagram-session/diagram-session-context";
import { DiagramSessionContext } from "@/diagram-session/diagram-session-context";
import {
	createDiagramSessionStore,
	type DiagramSessionStore,
} from "@/diagram-session/diagram-session-store";
import type { SchemaSourceMetadata } from "@/types";

export interface DiagramSessionProviderProps extends PropsWithChildren {
	readonly initialDiagram?: Diagram;
	readonly initialMetadata?: SchemaSourceMetadata;
}

export function DiagramSessionProvider({
	children,
	initialDiagram,
	initialMetadata,
}: DiagramSessionProviderProps) {
	const storeRef = useRef<DiagramSessionStore | null>(null);

	storeRef.current ??= createDiagramSessionStore(initialDiagram, initialMetadata);

	return (
		<DiagramSessionContext value={storeRef.current}>
			{children}
		</DiagramSessionContext>
	);
}
