import { useEffect, useEffectEvent } from "react";

import { useSourceFocusStore } from "@/canvas-next/source-focus/source-focus-context";

interface SourceFocusOrchestratorProps {
	readonly onOpenEditor: () => void;
}

export function SourceFocusOrchestrator({
	onOpenEditor,
}: SourceFocusOrchestratorProps) {
	const store = useSourceFocusStore();
	const openEditor = useEffectEvent(onOpenEditor);

	useEffect(() => {
		return store.subscribe(
			(state) => state.request,
			(request) => {
				if (request !== null) openEditor();
			},
		);
	}, [store]);

	return null;
}
