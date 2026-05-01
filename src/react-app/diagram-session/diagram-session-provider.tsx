import { useRef, type PropsWithChildren } from "react";

import type { Diagram } from "@/diagram-session/diagram-session-context";
import { DiagramSessionContext } from "@/diagram-session/diagram-session-context";
import {
	createDiagramSessionStore,
	type DiagramSessionStore,
} from "@/diagram-session/diagram-session-store";

export interface DiagramSessionProviderProps extends PropsWithChildren {
	readonly initialDiagram?: Diagram;
}

export function DiagramSessionProvider({
	children,
	initialDiagram,
}: DiagramSessionProviderProps) {
	const storeRef = useRef<DiagramSessionStore | null>(null);

	storeRef.current ??= createDiagramSessionStore(initialDiagram);

	return (
		<DiagramSessionContext value={storeRef.current}>
			{children}
		</DiagramSessionContext>
	);
}
