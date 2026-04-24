interface EditorBootstrapShellProps {
	readonly value: string;
	readonly isParsing: boolean;
	readonly readOnly?: boolean;
	readonly onUnlock?: () => void;
	readonly onChange: (value: string) => void;
	readonly onHide: () => void;
	readonly onActivate: () => void;
}

export function EditorBootstrapShell({
	value,
	isParsing,
	readOnly = false,
	onUnlock,
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
			{readOnly ? (
				<div className="flex items-center justify-between gap-3 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
					<span>Agent is editing this schema. User edits are locked.</span>
					{onUnlock ? (
						<button
							type="button"
							className="border border-amber-400/40 px-2 py-1 text-[11px] font-medium text-amber-100 transition-colors hover:bg-amber-400/10"
							onClick={onUnlock}
						>
							Unlock
						</button>
					) : null}
				</div>
			) : null}
			<textarea
				value={value}
				readOnly={readOnly}
				spellCheck={false}
				className="min-h-0 flex-1 resize-none border-0 bg-sidebar px-4 py-3 font-mono text-[13px] leading-7 text-sidebar-foreground outline-none read-only:cursor-not-allowed read-only:opacity-70"
				onChange={(event) => onChange(event.target.value)}
				onPointerDown={onActivate}
				onFocus={onActivate}
			/>
		</div>
	);
}
