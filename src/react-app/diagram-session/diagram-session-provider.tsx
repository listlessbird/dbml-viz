import { useRef, type PropsWithChildren } from "react";

import { DiagramSessionContext } from "@/diagram-session/diagram-session-context";
import {
	createDiagramSessionStore,
	type DiagramSessionStore,
} from "@/diagram-session/diagram-session-store";

export function DiagramSessionProvider({ children }: PropsWithChildren) {
	const storeRef = useRef<DiagramSessionStore | null>(null);

	storeRef.current ??= createDiagramSessionStore();

	return <DiagramSessionContext value={storeRef.current}>{children}</DiagramSessionContext>;
}
