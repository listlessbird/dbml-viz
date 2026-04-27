import { EditorOverlays } from "@/components/agent-connectivity/EditorOverlays";
import { EditorTitleStatus } from "@/components/agent-connectivity/EditorTitleStatus";

interface EditorBootstrapShellProps {
	readonly value: string;
	readonly isParsing: boolean;
	readonly readOnly?: boolean;
	readonly onChange: (value: string) => void;
	readonly onHide: () => void;
	readonly onActivate: () => void;
}

export function EditorBootstrapShell({
	value,
	isParsing,
	readOnly = false,
	onChange,
	onHide,
	onActivate,
}: EditorBootstrapShellProps) {
	return (
		<div className="dark flex h-full min-h-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
			<div className="flex min-h-12 items-center justify-between gap-3 border-b border-sidebar-border/80 px-3 text-xs text-muted-foreground">
				<div className="flex min-w-0 items-center gap-3">
					<span>{isParsing ? "Parsing schema…" : "Loading rich editor…"}</span>
					<EditorTitleStatus />
				</div>
				<button
					type="button"
					className="inline-flex min-h-8 items-center border border-sidebar-border/70 px-2.5 text-[11px] font-medium text-sidebar-foreground transition-[background-color,border-color,color] duration-200 ease-out hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring motion-reduce:transition-none"
					onClick={onHide}
				>
					Hide
				</button>
			</div>
			<div className="relative min-h-0 flex-1">
				<textarea
					value={value}
					readOnly={readOnly}
					spellCheck={false}
					className="size-full resize-none border-0 bg-sidebar px-4 py-3 font-mono text-[13px] leading-7 text-sidebar-foreground outline-none read-only:cursor-not-allowed read-only:opacity-70"
					onChange={(event) => onChange(event.target.value)}
					onPointerDown={onActivate}
					onFocus={onActivate}
				/>
				<EditorOverlays />
			</div>
		</div>
	);
}
