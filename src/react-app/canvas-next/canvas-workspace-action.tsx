import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { IconPlugConnectedX } from "@tabler/icons-react";

import { WorkspaceStatusPill } from "@/components/agent-connectivity/WorkspaceStatusPill";
import { ConnectAgentModal } from "@/components/agent-connectivity/ConnectAgentModal";
import {
	brandForClient,
	displayNameForClient,
	iconForClient,
} from "@/components/agent-connectivity/client-brands";
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
	const workspaceUrl = useWorkspace((state) => state.workspaceUrl);
	const mcpClientPresence = useWorkspace((state) => state.mcpClientPresence);
	const disconnectedClientName = useWorkspace((state) =>
		state.mcpClientPresence.status === "disconnected"
			? state.mcpClientPresence.clientInfo.title ??
			state.mcpClientPresence.clientInfo.name
			: null,
	);
	const attach = useWorkspace((state) => state.attach);
	const detach = useWorkspace((state) => state.detach);
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [isAlertOpen, setIsAlertOpen] = useState(false);

	const clientInfo =
		mcpClientPresence.status === "connected" ? mcpClientPresence.clientInfo : null;
	const clientName = clientInfo
		? displayNameForClient(clientInfo.name, clientInfo.title)
		: "your agent";
	const clientVersion = clientInfo?.version ?? null;
	const clientIcon = clientInfo ? iconForClient(clientInfo.name) : "/mcp.svg";
	const brand = useMemo(() => brandForClient(clientName), [clientName]);

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

	useEffect(() => {
		if (!disconnectedClientName) return;
		toast(`${disconnectedClientName} disconnected`);
	}, [disconnectedClientName]);

	return (
		<>
			<WorkspaceStatusPill
				status={status}
				tone="light"
				label={workspaceLabel(status)}
				hint={status}
				mcpClientPresence={mcpClientPresence}
				onClick={handleClick}
			/>
			<ConnectAgentModal
				open={isModalOpen}
				status={status}
				workspaceUrl={workspaceUrl}
				onOpenChange={setIsModalOpen}
			/>
			<AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
				<AlertDialogContent size="sm" style={{ maxWidth: "400px" }}>
					<AlertDialogHeader className="place-items-start text-left gap-1">
						<AlertDialogTitle className="font-heading text-[17px] font-semibold tracking-[-0.012em] leading-snug">
							Disconnect {clientName}?
						</AlertDialogTitle>
						<AlertDialogDescription>
							Would you like to disconnect your agent from the workspace?
						</AlertDialogDescription>
					</AlertDialogHeader>
					{clientInfo ? (
						<div className="relative flex items-start gap-3 border border-(--gray-200) bg-(--paper) px-3 py-[11px]">
							<div
								className="absolute inset-x-0 top-0 h-[2px]"
								style={{ backgroundColor: brand.dot }}
							/>
							<span className="inline-flex items-center justify-center size-8 shrink-0 border border-(--gray-300) bg-(--paper) mt-0.5">
								<img
									src={clientIcon}
									alt={clientName}
									width={22}
									height={22}
									className="block size-[22px] shrink-0 object-contain"
								/>
							</span>
							<div className="flex-1 min-w-0 flex items-baseline gap-2 flex-wrap mt-0.5">
								<span className="text-[14px] font-semibold leading-none text-(--gray-900) truncate">
									{clientName}
								</span>
								{clientVersion ? (
									<span className="font-mono text-[10px] leading-none border border-(--gray-300) px-1.5 py-[3px] text-(--gray-600) bg-(--gray-50) shrink-0">
										{clientVersion}
									</span>
								) : null}
							</div>
							<span
								aria-hidden="true"
								className="size-1.5 shrink-0 rounded-full acnx-dot-halo relative mt-1.5"
								style={{ backgroundColor: brand.dot, color: brand.dot }}
							/>
						</div>
					) : null}
					<AlertDialogFooter className="!flex !flex-row !items-center !justify-end !gap-3 -mx-4 -mb-4 px-4 py-[10px] border-t border-(--gray-200) bg-(--gray-50)">
						<AlertDialogCancel variant="ghost" size="sm" className="text-(--gray-600)">Keep connected</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							size="sm"
							className="bg-(--crimson-500) border border-(--crimson-500) text-white hover:bg-(--crimson-600) hover:border-(--crimson-600) gap-1.5"
							onClick={() => {
								detach();
								setIsAlertOpen(false);
							}}
						>
							<IconPlugConnectedX size={13} />
							Disconnect
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
