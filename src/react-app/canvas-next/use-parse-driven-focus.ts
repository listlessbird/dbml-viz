import { useEffect } from "react";

import { useCanvasRuntime } from "@/canvas-next/canvas-runtime-context";
import { useDiagramSession } from "@/diagram-session/diagram-session-context";

export function useParseDrivenFocus(): void {
	const addedTableIds = useDiagramSession(
		(state) => state.lastParseTableDiff.addedTableIds,
	);
	const requestFocus = useCanvasRuntime((state) => state.requestFocus);

	useEffect(() => {
		if (addedTableIds.length === 0) return;
		requestFocus(addedTableIds);
	}, [addedTableIds, requestFocus]);
}
