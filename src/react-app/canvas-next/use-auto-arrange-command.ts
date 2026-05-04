import { useCallback } from "react";

import {
	useCanvasRuntimeStore,
} from "@/canvas-next/canvas-runtime-context";
import { runDiagramAutoLayout } from "@/diagram-layout/diagram-layout";
import {
	useDiagramSession,
	useDiagramSessionStore,
} from "@/diagram-session/diagram-session-context";

export interface AutoArrangeCommand {
	readonly run: () => Promise<void>;
	readonly isAvailable: boolean;
}

export function useAutoArrangeCommand(): AutoArrangeCommand {
	const sessionStore = useDiagramSessionStore();
	const runtimeStore = useCanvasRuntimeStore();
	const isAvailable = useDiagramSession(
		(state) => state.diagram.parsedSchema.tables.length > 0,
	);

	const run = useCallback(async () => {
		const session = sessionStore.getState();
		if (session.diagram.parsedSchema.tables.length === 0) return;

		const result = await runDiagramAutoLayout({
			parsedSchema: session.diagram.parsedSchema,
			tablePositions: session.diagram.tablePositions,
			algorithm: "compact",
		});
		if (!result.ok) return;

		sessionStore.getState().commitTablePositions(result.tablePositions);
		runtimeStore.getState().requestFitView();
	}, [sessionStore, runtimeStore]);

	return { run, isAvailable };
}
