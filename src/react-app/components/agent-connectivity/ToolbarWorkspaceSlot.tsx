import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { useMemo } from "react";

import { AgentActivityLog } from "@/components/agent-connectivity/AgentActivityLog";
import { WorkspaceStatusPill } from "@/components/agent-connectivity/WorkspaceStatusPill";
import { useAgentActivityStore } from "@/store/useAgentActivityStore";
import type { WorkspaceStatus } from "@/types/workspace";

interface ToolbarWorkspaceSlotProps {
	readonly status: WorkspaceStatus;
	readonly workspaceId: string | null;
	readonly onConnect: () => void;
	readonly onShowWorkspace: () => void;
}


interface PillCopy {
	readonly label: string;
	readonly hint?: string;
	readonly kbd?: string;
}

function buildPillCopy(
	status: WorkspaceStatus,
	reconnectAttempt: number | null,
): PillCopy {
	switch (status) {
		case "offline":
			return { label: "Connect canvas to an agent	"};
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
			return { label: "Workspace expired" };
	}
}

export function ToolbarWorkspaceSlot({
	status,
	workspaceId,
	onConnect,
	onShowWorkspace,
}: ToolbarWorkspaceSlotProps) {
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
						<WorkspaceStatusPill
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
							<AgentActivityLog workspaceId={workspaceId} />
						</PopoverPrimitive.Popup>
					</PopoverPrimitive.Positioner>
				</PopoverPrimitive.Portal>
			</PopoverPrimitive.Root>
		);
	}

	const handleClick =
		status === "connecting" || status === "reconnecting" ? onShowWorkspace : onConnect;

	return (
		<WorkspaceStatusPill
			status={status}
			tone="dark"
			label={copy.label}
			hint={copy.hint}
			kbd={copy.kbd}
			onClick={handleClick}
		/>
	);
}
