
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ClientConfigSnippet } from "@/components/agent-connectivity/ClientConfigSnippet";
import { CopyButton } from "@/components/agent-connectivity/CopyButton";
import { getDisplayEndpoint } from "@/lib/agent-client-snippets";
import { cn } from "@/lib/utils";
import type { WorkspaceStatus } from "@/types/workspace";

interface ConnectAgentModalProps {
	readonly open: boolean;
	readonly status: WorkspaceStatus;
	readonly workspaceUrl: string | null;
	readonly onOpenChange: (open: boolean) => void;
}

interface ConnectionLightProps {
	readonly label: string;
	readonly active: boolean;
	readonly pulse?: boolean;
}

function ConnectionLight({ label, active, pulse = false }: ConnectionLightProps) {
	return (
		<span className="inline-flex items-center gap-1.5 text-[11px] text-(--gray-600)">
			<span
				aria-hidden="true"
				className={cn(
					"size-1.5 rounded-full",
					active
						? "bg-[oklch(0.5_0.14_155)] text-[oklch(0.5_0.14_155)]"
						: "bg-(--gray-300)",
					active && "acnx-dot-halo relative",
					pulse && "acnx-dot-pulse",
				)}
			/>
			{label}
		</span>
	);
}

export function ConnectAgentModal({
	open,
	status,
	workspaceUrl,
	onOpenChange,
}: ConnectAgentModalProps) {
	const endpoint = workspaceUrl ? getDisplayEndpoint(workspaceUrl) : null;
	const isLive = status === "live";
	const isAttaching = status === "connecting" || status === "reconnecting";
	const browserActive = isLive || isAttaching;
	const agentActive = isLive;
	const agentLabel = isLive ? "Workspace ready" : "Waiting for workspace…";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="gap-0 overflow-hidden border-(--gray-300) bg-(--paper) p-0 text-(--gray-900) shadow-[0_10px_40px_-10px_rgba(0,0,0,0.25),0_1px_3px_rgba(0,0,0,0.06)] ring-0 sm:max-w-[440px]">
				<DialogHeader className="min-w-0 border-b border-(--gray-200) px-4 pb-2.5 pr-10 pt-3">
					<DialogTitle className="font-heading text-[16px] font-semibold tracking-tight text-(--gray-900)">
						Connect canvas to your agent
					</DialogTitle>
					<DialogDescription className="text-[12px] leading-[1.55] text-(--gray-600)">
						Run the command below in your terminal to connect your agent to this canvas.
					</DialogDescription>
				</DialogHeader>

				{endpoint ? (
					<div className="min-w-0 space-y-3 overflow-hidden px-4 pb-4 pt-3.5">
						<div className="space-y-1.5">
							<label className="block font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-(--gray-500)">
								Workspace URL
							</label>
							<div className="flex min-w-0 items-stretch">
								<input
									readOnly
									value={endpoint}
									className="min-w-0 flex-1 truncate border border-r-0 border-(--gray-300) bg-(--gray-50) px-2.5 py-1.5 font-mono text-[11px] text-(--gray-900) outline-none focus-visible:border-(--gray-400)"
								/>
								<CopyButton value={endpoint} className="h-auto! rounded-none! border-l-0" />
							</div>
						</div>
						<ClientConfigSnippet endpoint={endpoint} />
					</div>
				) : null}

				<DialogFooter className="flex-row flex-wrap items-center justify-between gap-3 border-t border-(--gray-200) bg-(--gray-50) px-4 py-2.5 sm:justify-between">
					<div className="flex flex-wrap items-center gap-3.5">
						<ConnectionLight label="Browser" active={browserActive} />
						<ConnectionLight
							label={agentLabel}
							active={agentActive}
							pulse={!agentActive && browserActive}
						/>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
