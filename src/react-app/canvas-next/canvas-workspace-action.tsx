import { useState } from "react";

import { WorkspaceStatusPill } from "@/components/agent-connectivity/WorkspaceStatusPill";
import { ConnectAgentModal } from "@/components/agent-connectivity/ConnectAgentModal";
import {
	AlertDialog,
	AlertDialogContent,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogAction,
	AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { useWorkspace } from "@/workspace/workspace-context";
import type { WorkspaceStatus } from "@/types/workspace";

const workspaceLabel = (status: WorkspaceStatus) => {
	switch (status) {
		case "offline":
			return "Connect workspace";
		case "connecting":
			return "Connecting";
		case "live":
			return "Live";
		case "reconnecting":
			return "Reconnecting";
		case "ended":
			return "Workspace expired";
	}
};

export function CanvasNextWorkspaceAction() {
	const status = useWorkspace((state) => state.status);
	const workspaceId = useWorkspace((state) => state.workspaceId);
	const attach = useWorkspace((state) => state.attach);
	const detach = useWorkspace((state) => state.detach);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isAlertOpen, setIsAlertOpen] = useState(false);

	const handleClick = () => {
		if (status === "live") {
			setIsAlertOpen(true);
			return;
		}
		if (status === "offline" || status === "ended") {
			attach();
		}
		setIsModalOpen(true);
	};

	return (
		<>
			<WorkspaceStatusPill
				status={status}
				tone="light"
				label={workspaceLabel(status)}
				hint={status}
				onClick={handleClick}
			/>
			<ConnectAgentModal
				open={isModalOpen}
				status={status}
				workspaceUrl={workspaceId}
				onOpenChange={setIsModalOpen}
			/>
			<AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
				<AlertDialogContent size="sm">
					<AlertDialogHeader>
						<AlertDialogTitle>Close active connection?</AlertDialogTitle>
						<AlertDialogDescription>
							Your agent is currently connected to this workspace. Disconnecting
							will end the session and your agent will lose access.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep connected</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => {
								detach();
								setIsAlertOpen(false);
							}}
						>
							Disconnect
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
