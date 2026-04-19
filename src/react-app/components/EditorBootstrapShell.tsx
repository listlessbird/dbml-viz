interface EditorBootstrapShellProps {
	readonly value: string;
	readonly isParsing: boolean;
	readonly onChange: (value: string) => void;
	readonly onHide: () => void;
	readonly onActivate: () => void;
}

export function EditorBootstrapShell({
	value,
	isParsing,
	onChange,
	onHide,
	onActivate,
}: EditorBootstrapShellProps) {
	return (
		<div className="dark flex h-full min-h-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground">
			<div className="flex min-h-12 items-center justify-between border-b border-sidebar-border/80 px-3 text-xs text-muted-foreground">
				<span>{isParsing ? "Parsing schema…" : "Loading rich editor…"}</span>
				<button
					type="button"
					className="inline-flex min-h-8 items-center border border-sidebar-border/70 px-2.5 text-[11px] font-medium text-sidebar-foreground transition-[background-color,border-color,color] duration-200 ease-out hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring motion-reduce:transition-none"
					onClick={onHide}
				>
					Hide
				</button>
			</div>
			<div className="border-b border-sidebar-border/70 px-3 py-2 text-[11px] text-muted-foreground">
				Basic editing is available immediately. The full CodeMirror editor upgrades in the
				background.
			</div>
			<textarea
				value={value}
				spellCheck={false}
				className="min-h-0 flex-1 resize-none border-0 bg-sidebar px-4 py-3 font-mono text-[13px] leading-7 text-sidebar-foreground outline-none"
				onChange={(event) => onChange(event.target.value)}
				onPointerDown={onActivate}
				onFocus={onActivate}
			/>
		</div>
	);
}
