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
	return (
		<span
			className="size-1.5 shrink-0 rounded-full bg-sidebar-primary"
			style={{ boxShadow: "0 0 0 2px color-mix(in oklab, var(--sidebar-primary) 20%, transparent)" }}
		/>
	);
}

function ShareStatus({ shareId, isDirty }: { shareId: string | null; isDirty: boolean }) {
	const [copied, setCopied] = useState(false);

	if (shareId === null) {
		return (
			<span
				title="Saved in this browser until you create a share link."
				className="shrink-0 inline-flex items-center gap-1.5 text-[11px] text-sidebar-muted-foreground"
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
		<div className="shrink-0 inline-flex items-center gap-[10px] text-[11px] text-sidebar-muted-foreground">
			<span className="inline-flex items-center gap-1.5">
				<StatusDot />
				Shared snapshot
			</span>
			<span className="inline-flex items-center gap-1.5 border border-white/[0.14] px-1.5 py-0.5">
				<span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--gray-400)]">
					ID
				</span>
				<span className="font-mono text-[10px] text-[var(--gray-300)]">{shareId}</span>
			</span>
			<button
				type="button"
				title={copied ? "Copied!" : "Copy share link"}
				className="inline-flex items-center gap-1 border border-white/[0.14] px-2 py-1 text-[11px] text-sidebar-foreground transition-[background-color,border-color] duration-[120ms] hover:border-white/25 hover:bg-sidebar-accent"
				onClick={() => void handleCopy()}
			>
				{copied ? (
					<IconCheck className="size-3 text-sidebar-primary" />
				) : (
					<IconCopy className="size-3" />
				)}
				{copied ? "Copied" : "Copy link"}
			</button>
			{isDirty ? (
				<span className="text-sidebar-muted-foreground/60">Local edits not shared</span>
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
			<div className="flex min-w-0 flex-1 items-center gap-[18px] overflow-x-auto px-4">
				<span className="shrink-0 font-semibold tracking-tight text-sidebar-foreground">
					dbml-viz
				</span>
				<span className="shrink-0 text-[11px] tabular-nums text-sidebar-muted-foreground">
					{tableCount} {tableCount === 1 ? "table" : "tables"}
				</span>
				<span className="shrink-0 text-[11px] tabular-nums text-sidebar-muted-foreground">
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
