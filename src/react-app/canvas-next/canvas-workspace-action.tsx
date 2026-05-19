import { useCallback, useEffect, useMemo, useState } from "react";
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
			return "Workspace ended";
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
	const endWorkspace = useWorkspace((state) => state.endWorkspace);
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

	const handleClick = useCallback(() => {
		if (status === "live") {
			setIsAlertOpen(true);
			return;
		}
		if (status === "offline" || status === "ended") {
			attach();
		}
		setIsModalOpen(true);
	}, [attach, status]);

	const handleEndWorkspace = useCallback(() => {
		endWorkspace();
		setIsAlertOpen(false);
	}, [endWorkspace]);

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
							End workspace?
						</AlertDialogTitle>
						<AlertDialogDescription>
							This will end the live workspace and close {clientName}'s MCP session.
						</AlertDialogDescription>
					</AlertDialogHeader>
					{clientInfo ? (
						<div className="relative flex items-start gap-3 border border-border bg-background px-3 py-[11px]">
							<div className={`absolute inset-x-0 top-0 h-[var(--dimension-client-brand-bar-height)] ${brand.dotBg}`} />
							<span className="mt-0.5 inline-flex size-[var(--dimension-client-card-icon-tile)] shrink-0 items-center justify-center border border-border-strong bg-background rounded-control">
								<img
									src={clientIcon}
									alt={clientName}
									width={22}
									height={22}
									className="block size-[var(--dimension-client-card-icon)] shrink-0 object-contain"
								/>
							</span>
							<div className="mt-0.5 flex min-w-0 flex-1 flex-wrap items-baseline gap-2">
								<span className="truncate text-[14px] font-semibold leading-none text-foreground">
									{clientName}
								</span>
								{clientVersion ? (
									<span className="shrink-0 border border-border-strong bg-muted px-1.5 py-[3px] font-mono text-[10px] leading-none text-muted-foreground">
										{clientVersion}
									</span>
								) : null}
							</div>
							<span
								aria-hidden="true"
								className={`size-[var(--dimension-status-dot)] shrink-0 rounded-full acnx-dot-halo relative mt-1.5 ${brand.dotBg} ${brand.dotText}`}
							/>
						</div>
					) : null}
					<AlertDialogFooter className="-mx-4 -mb-4 !flex !flex-row !items-center !justify-end !gap-3 border-t border-border bg-muted px-4 py-[10px]">
						<AlertDialogCancel variant="ghost" size="sm" className="text-muted-foreground">Keep connected</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							size="sm"
							className="gap-1.5 border border-destructive bg-destructive text-destructive-foreground hover:border-destructive-hover hover:bg-destructive-hover"
							onClick={handleEndWorkspace}
						>
							<IconPlugConnectedX size={13} />
							End workspace
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
