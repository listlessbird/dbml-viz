import { IconCheck, IconLink } from "@tabler/icons-react";
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

function RouteLabel({ shareId, isDirty }: { shareId: string | null; isDirty: boolean }) {
	const [copied, setCopied] = useState(false);

	if (shareId === null) {
		return (
			<span className="shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground">
				<span className="size-1.5 rounded-full bg-primary/60" />
				Auto-saved
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
		<button
			type="button"
			title={copied ? "Copied!" : "Copy share link"}
			className="shrink-0 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
			onClick={() => void handleCopy()}
		>
			{copied ? (
				<IconCheck className="size-3 text-primary" />
			) : (
				<IconLink className="size-3" />
			)}
			<span className="font-mono">{shareId}</span>
			{isDirty ? (
				<span className="text-muted-foreground/60">· edited</span>
			) : null}
		</button>
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
				<RouteLabel shareId={shareId} isDirty={isDirty} />
			</div>

			<div className="flex shrink-0 items-stretch border-l border-border">
				<ShareButton isSharing={isSharing} onShare={onShare} />
			</div>
		</div>
	);
}
