import { IconCheck, IconCopy, IconLoader2, IconPlugConnected } from "@tabler/icons-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { SessionStatus } from "@/types/session";

interface ConnectAgentModalProps {
	readonly open: boolean;
	readonly status: SessionStatus;
	readonly pairingUrl: string | null;
	readonly agentEditorLocked: boolean;
	readonly onOpenChange: (open: boolean) => void;
	readonly onDisconnect: () => void;
	readonly onUnlockEditor: () => void;
}

function CopyButton({ value }: { readonly value: string }) {
	const [copied, setCopied] = useState(false);
	const resetTimerRef = useRef<number | null>(null);

	useEffect(() => {
		return () => {
			if (resetTimerRef.current !== null) {
				window.clearTimeout(resetTimerRef.current);
			}
		};
	}, []);

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			if (resetTimerRef.current !== null) {
				window.clearTimeout(resetTimerRef.current);
			}
			resetTimerRef.current = window.setTimeout(() => setCopied(false), 1600);
		} catch {
			toast.error("Unable to copy to clipboard.");
		}
	}, [value]);

	return (
		<Button type="button" variant="outline" size="xs" onClick={() => void handleCopy()}>
			{copied ? <IconCheck className="size-3" /> : <IconCopy className="size-3" />}
			{copied ? "Copied" : "Copy"}
		</Button>
	);
}

function Snippet({
	label,
	value,
}: {
	readonly label: string;
	readonly value: string;
}) {
	return (
		<div className="space-y-1.5">
			<div className="flex items-center justify-between gap-3">
				<p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
					{label}
				</p>
				<CopyButton value={value} />
			</div>
			<pre className="max-h-40 overflow-auto border border-border bg-muted/50 p-3 font-mono text-[11px] leading-5 text-foreground">
				{value}
			</pre>
		</div>
	);
}

export function ConnectAgentModal({
	open,
	status,
	pairingUrl,
	agentEditorLocked,
	onOpenChange,
	onDisconnect,
	onUnlockEditor,
}: ConnectAgentModalProps) {
	if (!open) {
		return null;
	}

	const endpoint = pairingUrl ?? "Starting session...";
	const addMcpCommand = `npx add-mcp ${endpoint} -a codex -a cursor -a claude-code`;
	const codexCommand = `codex mcp add dbml-canvas --url ${endpoint}`;
	const claudeCommand = `claude mcp add-json dbml-canvas '${JSON.stringify({
		type: "http",
		url: endpoint,
	})}'`;
	const cursorConfig = JSON.stringify(
		{
			mcpServers: {
				"dbml-canvas": {
					url: endpoint,
				},
			},
		},
		null,
		2,
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle className="inline-flex items-center gap-2">
						{status === "connecting" ? (
							<IconLoader2 className="size-4 animate-spin" />
						) : (
							<IconPlugConnected className="size-4" />
						)}
						Connect an agent
					</DialogTitle>
					<DialogDescription>
						Connect Claude Code, Codex, Cursor, or another MCP client to this live canvas.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<Snippet label="MCP endpoint" value={endpoint} />
					<Snippet label="One command for common clients" value={addMcpCommand} />
					<div className="grid gap-4 md:grid-cols-2">
						<Snippet label="Codex fallback" value={codexCommand} />
						<Snippet label="Claude Code fallback" value={claudeCommand} />
					</div>
					<Snippet label="Cursor mcp.json" value={cursorConfig} />
					{agentEditorLocked ? (
						<div className="flex items-center justify-between gap-3 border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
							<span>Agent changed the source. Editor is locked to prevent conflicting edits.</span>
							<Button type="button" variant="outline" size="xs" onClick={onUnlockEditor}>
								Unlock editor
							</Button>
						</div>
					) : null}
				</div>

				<DialogFooter>
					<Button type="button" variant="destructive" onClick={onDisconnect}>
						Disconnect
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
