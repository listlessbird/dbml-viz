import { useCallback } from "react";

import { useCanvasRuntimeStore } from "@/canvas-next/canvas-runtime-context";
import {
	detectOverlappingTablePositions,
	repairOverlappingTablePositions,
} from "@/diagram-layout/diagram-layout";
import {
	useDiagramSession,
	useDiagramSessionStore,
} from "@/diagram-session/diagram-session-context";

export interface RepairOverlapsCommand {
	readonly run: () => Promise<void>;
	readonly isAvailable: boolean;
}

export function useRepairOverlapsCommand(): RepairOverlapsCommand {
	const sessionStore = useDiagramSessionStore();
	const runtimeStore = useCanvasRuntimeStore();
	const isAvailable = useDiagramSession(
		(state) => state.diagram.parsedSchema.tables.length > 0,
	);

	const run = useCallback(async () => {
		const session = sessionStore.getState();
		const parsedSchema = session.diagram.parsedSchema;
		const tablePositions = session.diagram.tablePositions;
		if (parsedSchema.tables.length === 0) return;

		const overlap = detectOverlappingTablePositions(
			parsedSchema,
			tablePositions,
		);
		if (!overlap.hasOverlaps) return;

		const result = await repairOverlappingTablePositions({
			parsedSchema,
			tablePositions,
			algorithm: "compact",
		});
		if (!result.ok) return;

		sessionStore.getState().commitTablePositions(result.tablePositions);
		runtimeStore.getState().requestFitView();
	}, [sessionStore, runtimeStore]);

	return { run, isAvailable };
}
