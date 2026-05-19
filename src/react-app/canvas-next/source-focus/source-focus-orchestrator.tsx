import { useEffect, useRef } from "react";

import { useSourceFocusStore } from "@/canvas-next/source-focus/source-focus-context";

interface SourceFocusOrchestratorProps {
	readonly onOpenEditor: () => void;
}

export function SourceFocusOrchestrator({
	onOpenEditor,
}: SourceFocusOrchestratorProps) {
	const store = useSourceFocusStore();
	const onOpenEditorRef = useRef(onOpenEditor);
	onOpenEditorRef.current = onOpenEditor;

	useEffect(() => {
		return store.subscribe(
			(state) => state.request,
			(request) => {
				if (request !== null) onOpenEditorRef.current();
			},
		);
	}, [store]);

	return null;
}
