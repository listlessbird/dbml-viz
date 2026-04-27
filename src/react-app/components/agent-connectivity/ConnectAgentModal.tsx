import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { IconX } from "@tabler/icons-react";

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
	readonly onDisconnect: () => void;
}

interface ConnectionLightProps {
	readonly label: string;
	readonly active: boolean;
	readonly pulse?: boolean;
}

function ConnectionLight({ label, active, pulse = false }: ConnectionLightProps) {
	return (
		<span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--gray-600)]">
			<span
				aria-hidden="true"
				className={cn(
					"size-1.5 rounded-full",
					active
						? "bg-[oklch(0.5_0.14_155)] text-[oklch(0.5_0.14_155)]"
						: "bg-[var(--gray-300)]",
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
	onDisconnect,
}: ConnectAgentModalProps) {
	const endpoint = workspaceUrl ? getDisplayEndpoint(workspaceUrl) : null;
	const isLive = status === "live";
	const isAttaching = status === "connecting" || status === "reconnecting";
	const browserActive = isLive || isAttaching;
	const agentActive = isLive;
	const agentLabel = isLive ? "Workspace ready" : "Waiting for workspace…";

	return (
		<DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
			<DialogPrimitive.Portal>
				<DialogPrimitive.Backdrop
					className="fixed inset-0 z-50 bg-black/15 supports-backdrop-filter:backdrop-blur-xs duration-100 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
				/>
				<DialogPrimitive.Popup
					className="fixed left-1/2 top-1/2 z-50 w-[440px] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden border border-[var(--gray-300)] bg-[var(--paper)] text-[var(--gray-900)] shadow-[0_10px_40px_-10px_rgba(0,0,0,0.25),0_1px_3px_rgba(0,0,0,0.06)] duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
				>
					<header className="flex items-center gap-2.5 border-b border-[var(--gray-200)] px-4 pb-2.5 pt-3">
						<DialogPrimitive.Title className="font-heading text-[16px] font-semibold tracking-tight text-[var(--gray-900)]">
							Connect canvas to your agent
						</DialogPrimitive.Title>
						<DialogPrimitive.Close
							className="ml-auto inline-flex size-[22px] cursor-pointer items-center justify-center border border-[var(--gray-200)] bg-transparent font-mono text-[var(--gray-500)] transition-colors hover:bg-[var(--gray-100)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--gray-400)]"
							aria-label="Close"
						>
							<IconX className="size-3" />
						</DialogPrimitive.Close>
					</header>

					<div className="space-y-3 px-4 pb-4 pt-3.5">
						<DialogPrimitive.Description className="text-[12px] leading-[1.55] text-[var(--gray-600)]">
							Your agent connects via{" "}
							<code className="rounded-none bg-[var(--gray-100)] px-1 font-mono text-[11px] text-[var(--gray-800)]">
								MCP
							</code>
							. The workspace URL appears after the browser syncs with the remote workspace.
						</DialogPrimitive.Description>

						{endpoint ? (
							<>
								<div className="space-y-1.5">
									<label className="block font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[var(--gray-500)]">
										MCP endpoint
									</label>
									<div className="flex items-stretch">
										<input
											readOnly
											value={endpoint}
											className="min-w-0 flex-1 truncate border border-r-0 border-[var(--gray-300)] bg-[var(--gray-50)] px-2.5 py-1.5 font-mono text-[11px] text-[var(--gray-900)] outline-none focus-visible:border-[var(--gray-400)]"
										/>
										<CopyButton
											value={endpoint}
											className="!h-auto !rounded-none border-l-0"
										/>
									</div>
								</div>

								<ClientConfigSnippet endpoint={endpoint} />
							</>
						) : null}
					</div>

					<footer className="flex items-center gap-3 border-t border-[var(--gray-200)] bg-[var(--gray-50)] px-4 py-2.5">
						<div className="flex items-center gap-3.5">
							<ConnectionLight label="Browser" active={browserActive} />
							<ConnectionLight
								label={agentLabel}
								active={agentActive}
								pulse={!agentActive && browserActive}
							/>
						</div>
						<span className="flex-1" />
						<button
							type="button"
							className="inline-flex h-7 cursor-pointer items-center border border-[var(--crimson-500)] bg-[var(--paper)] px-3 text-[12px] font-medium text-[var(--crimson-700)] transition-colors hover:bg-[var(--crimson-50)] disabled:cursor-not-allowed disabled:opacity-50"
							onClick={onDisconnect}
							disabled={status === "offline" || status === "ended"}
						>
							Disconnect
						</button>
					</footer>
				</DialogPrimitive.Popup>
			</DialogPrimitive.Portal>
		</DialogPrimitive.Root>
	);
}
