import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { useMemo } from "react";

import { AgentActivityLog } from "@/components/agent-connectivity/AgentActivityLog";
import { SessionStatusPill } from "@/components/agent-connectivity/SessionStatusPill";
import { useAgentActivityStore } from "@/store/useAgentActivityStore";
import type { SessionStatus } from "@/types/session";

interface ToolbarSessionSlotProps {
	readonly status: SessionStatus;
	readonly sessionId: string | null;
	readonly onConnect: () => void;
	readonly onShowSession: () => void;
}

const CONNECT_KBD = "⌘⇧K";

interface PillCopy {
	readonly label: string;
	readonly hint?: string;
	readonly kbd?: string;
}

function buildPillCopy(
	status: SessionStatus,
	reconnectAttempt: number | null,
): PillCopy {
	switch (status) {
		case "offline":
			return { label: "Connect canvas", kbd: CONNECT_KBD };
		case "connecting":
			return { label: "Connecting…" };
		case "live":
			return { label: "Live", hint: "1 agent" };
		case "reconnecting":
			return {
				label: "Reconnecting",
				hint: reconnectAttempt ? `attempt ${reconnectAttempt}` : undefined,
			};
		case "ended":
			return { label: "Session expired" };
	}
}

export function ToolbarSessionSlot({
	status,
	sessionId,
	onConnect,
	onShowSession,
}: ToolbarSessionSlotProps) {
	const reconnect = useAgentActivityStore((state) => state.reconnect);
	const copy = useMemo(
		() => buildPillCopy(status, reconnect?.attempt ?? null),
		[status, reconnect],
	);

	if (status === "live") {
		return (
			<PopoverPrimitive.Root>
				<PopoverPrimitive.Trigger
					render={
						<SessionStatusPill
							status="live"
							tone="dark"
							label={copy.label}
							hint={copy.hint}
							aria-label="Open agent activity log"
						/>
					}
				/>
				<PopoverPrimitive.Portal>
					<PopoverPrimitive.Positioner
						side="bottom"
						align="end"
						sideOffset={6}
						className="isolate z-50"
					>
						<PopoverPrimitive.Popup className="outline-none">
							<AgentActivityLog sessionId={sessionId} />
						</PopoverPrimitive.Popup>
					</PopoverPrimitive.Positioner>
				</PopoverPrimitive.Portal>
			</PopoverPrimitive.Root>
		);
	}

	const handleClick =
		status === "connecting" || status === "reconnecting" ? onShowSession : onConnect;

	return (
		<SessionStatusPill
			status={status}
			tone="dark"
			label={copy.label}
			hint={copy.hint}
			kbd={copy.kbd}
			onClick={handleClick}
		/>
	);
}
