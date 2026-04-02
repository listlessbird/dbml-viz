import { ShareButton } from "@/components/ShareButton";

interface ToolbarProps {
	readonly tableCount: number;
	readonly relationCount: number;
	readonly isSharing: boolean;
	readonly routeLabel: string;
	readonly onShare: () => void;
}

export function Toolbar({
	tableCount,
	relationCount,
	isSharing,
	routeLabel,
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
				<span className="shrink-0 text-xs text-muted-foreground">
					{routeLabel}
				</span>
			</div>

			<div className="flex shrink-0 items-stretch border-l border-border">
				<ShareButton isSharing={isSharing} onShare={onShare} />
			</div>
		</div>
	);
}
