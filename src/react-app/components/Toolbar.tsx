import { IconCheck, IconCopy } from "@tabler/icons-react";
import { useState } from "react";

import { ShareButton } from "@/components/ShareButton";

interface ToolbarProps {
	readonly tableCount: number;
	readonly relationCount: number;
	readonly isSharing: boolean;
	readonly shareId: string | null;
	readonly isDirty: boolean;
	readonly onShare: () => void;
}

function StatusDot() {
	return <span className="size-1.5 rounded-full bg-primary/60" />;
}

function ShareStatus({ shareId, isDirty }: { shareId: string | null; isDirty: boolean }) {
	const [copied, setCopied] = useState(false);

	if (shareId === null) {
		return (
			<span
				title="Saved in this browser until you create a share link."
				className="shrink-0 inline-flex items-center gap-1.5 text-xs text-muted-foreground"
			>
				<StatusDot />
				Auto-saved locally
			</span>
		);
	}

	const shareUrl = new URL(`/s/${shareId}`, window.location.origin).toString();

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(shareUrl);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// clipboard unavailable — no-op, toast in useShareSchema covers the error path
		}
	};

	return (
		<div className="shrink-0 inline-flex items-center gap-2 text-xs text-muted-foreground">
			<span className="inline-flex items-center gap-1.5">
				<StatusDot />
				Shared snapshot
			</span>
			<span className="inline-flex items-center gap-1 border border-border/70 px-1.5 py-0.5 text-[11px] text-muted-foreground/75">
				<span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground/45">
					ID
				</span>
				<span className="font-mono">{shareId}</span>
			</span>
			<button
				type="button"
				title={copied ? "Copied!" : "Copy share link"}
				className="inline-flex items-center gap-1 border border-border/70 px-2 py-1 text-[11px] text-sidebar-foreground transition-colors hover:border-border hover:text-foreground"
				onClick={() => void handleCopy()}
			>
				{copied ? (
					<IconCheck className="size-3 text-primary" />
				) : (
					<IconCopy className="size-3" />
				)}
				{copied ? "Copied" : "Copy link"}
			</button>
			{isDirty ? (
				<span className="text-muted-foreground/60">Local edits not shared</span>
			) : null}
		</div>
	);
}

export function Toolbar({
	tableCount,
	relationCount,
	isSharing,
	shareId,
	isDirty,
	onShare,
}: ToolbarProps) {
	return (
		<div className="dark flex min-h-12 items-stretch border-b border-border bg-sidebar text-sidebar-foreground">
			<div className="flex min-w-0 flex-1 items-center gap-4 overflow-x-auto px-4 text-sm">
				<span className="shrink-0 font-medium tracking-tight text-sidebar-foreground">
					DBML Visualizer
				</span>
				<span className="shrink-0 text-xs text-muted-foreground">
					{tableCount} {tableCount === 1 ? "table" : "tables"}
				</span>
				<span className="shrink-0 text-xs text-muted-foreground">
					{relationCount} {relationCount === 1 ? "relationship" : "relationships"}
				</span>
				<ShareStatus shareId={shareId} isDirty={isDirty} />
			</div>

			<div className="flex shrink-0 items-stretch border-l border-border">
				<ShareButton isSharing={isSharing} onShare={onShare} />
			</div>
		</div>
	);
}
