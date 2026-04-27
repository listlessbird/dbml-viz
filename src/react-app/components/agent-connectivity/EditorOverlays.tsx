import { useCallback } from "react";

import { EditorAgentWritingOverlay } from "@/components/agent-connectivity/EditorAgentWritingOverlay";
import { EditorReconnectVeil } from "@/components/agent-connectivity/EditorReconnectVeil";
import { useAgentActivityStore } from "@/store/useAgentActivityStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";

export function EditorOverlays() {
	const writing = useAgentActivityStore((state) => state.writing);
	const reconnect = useAgentActivityStore((state) => state.reconnect);
	const endAgentWriting = useAgentActivityStore((state) => state.endAgentWriting);
	const unlockEditor = useWorkspaceStore((state) => state.unlockEditor);

	const handleAgentWritingComplete = useCallback(() => {
		endAgentWriting();
		unlockEditor();
	}, [endAgentWriting, unlockEditor]);

	return (
		<>
			{writing ? (
				<EditorAgentWritingOverlay
					key={writing.startedAt}
					writing={writing}
					onComplete={handleAgentWritingComplete}
				/>
			) : null}
			{reconnect ? (
				<EditorReconnectVeil
					key={`${reconnect.attempt}-${reconnect.nextDelayMs}`}
					reconnect={reconnect}
				/>
			) : null}
		</>
	);
}
