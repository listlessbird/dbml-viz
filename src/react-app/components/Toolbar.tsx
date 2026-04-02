import { IconFocus2, IconLayoutGrid } from "@tabler/icons-react";

import { ShareButton } from "@/components/ShareButton";

interface ToolbarProps {
	readonly tableCount: number;
	readonly relationCount: number;
	readonly isLayouting: boolean;
	readonly isSharing: boolean;
	readonly shareId: string | null;
	readonly onAutoLayout: () => void;
	readonly onFitView: () => void;
	readonly onShare: () => void;
}

export function Toolbar({
	tableCount,
	relationCount,
	isLayouting,
	isSharing,
	shareId,
	onAutoLayout,
	onFitView,
	onShare,
}: ToolbarProps) {
	return (
		<div className="dark flex h-12 items-stretch border-b border-border bg-sidebar text-sidebar-foreground">
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
				<span className="truncate text-xs text-muted-foreground">
					{shareId ? `/s/${shareId}` : "draft"}
				</span>
			</div>

			<div className="flex shrink-0 items-stretch border-l border-border">
				<button
					type="button"
					className="inline-flex items-center gap-2 border-l border-border px-3 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent disabled:cursor-not-allowed disabled:text-muted-foreground"
					onClick={onAutoLayout}
					disabled={isLayouting}
				>
					<IconLayoutGrid className="size-4" />
					{isLayouting ? "Laying out" : "Auto layout"}
				</button>
				<button
					type="button"
					className="inline-flex items-center gap-2 border-l border-border px-3 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent"
					onClick={onFitView}
				>
					<IconFocus2 className="size-4" />
					Fit view
				</button>
				<ShareButton isSharing={isSharing} onShare={onShare} />
			</div>
		</div>
	);
}
