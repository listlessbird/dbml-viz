import { oneDark } from "@codemirror/theme-one-dark";
import {
	EditorState,
	StateEffect,
	StateField,
} from "@codemirror/state";
import {
	Decoration,
	EditorView,
	drawSelection,
	dropCursor,
	highlightActiveLine,
	highlightActiveLineGutter,
	lineNumbers,
} from "@codemirror/view";
import { sql } from "@codemirror/lang-sql";
import { IconAlertTriangle } from "@tabler/icons-react";
import { useEffectEvent } from "react";
import { useEffect, useRef } from "react";

import type { EditorPosition, ParseDiagnostic } from "@/types";

interface EditorProps {
	readonly value: string;
	readonly diagnostics: readonly ParseDiagnostic[];
	readonly isParsing: boolean;
	readonly onChange: (value: string) => void;
}

const setDiagnosticsEffect = StateEffect.define<readonly ParseDiagnostic[]>();

const diagnosticMark = Decoration.mark({
	class: "cm-parse-error-range",
});

const diagnosticLine = Decoration.line({
	class: "cm-parse-error-line",
});

const getOffsetForPosition = (state: EditorState, position: EditorPosition) => {
	const lineNumber = Math.max(1, Math.min(position.line, state.doc.lines));
	const line = state.doc.line(lineNumber);
	const characterOffset = Math.max(0, position.column - 1);
	return Math.min(line.to, line.from + characterOffset);
};

const buildDiagnosticDecorations = (
	state: EditorState,
	diagnostics: readonly ParseDiagnostic[],
) => {
	const decorations: ReturnType<typeof diagnosticMark.range>[] = [];
	const highlightedLines = new Set<number>();

	for (const diagnostic of diagnostics) {
		const start = diagnostic.location?.start;
		if (!start) {
			continue;
		}

		const from = getOffsetForPosition(state, start);
		const to = diagnostic.location?.end
			? getOffsetForPosition(state, diagnostic.location.end)
			: Math.min(state.doc.length, from + 1);
		const safeTo = to > from ? to : Math.min(state.doc.length, from + 1);
		const line = state.doc.lineAt(from);

		if (!highlightedLines.has(line.number)) {
			decorations.push(diagnosticLine.range(line.from));
			highlightedLines.add(line.number);
		}

		decorations.push(diagnosticMark.range(from, safeTo));
	}

	return Decoration.set(decorations, true);
};

const diagnosticField = StateField.define({
	create() {
		return Decoration.none;
	},
	update(value, transaction) {
		const mapped = value.map(transaction.changes);

		for (const effect of transaction.effects) {
			if (effect.is(setDiagnosticsEffect)) {
				return buildDiagnosticDecorations(transaction.state, effect.value);
			}
		}

		return mapped;
	},
	provide: (field) => EditorView.decorations.from(field),
});

const editorTheme = EditorView.theme({
	"&": {
		height: "100%",
		backgroundColor: "var(--sidebar)",
		color: "var(--sidebar-foreground)",
	},
	".cm-scroller": {
		fontFamily: '"IBM Plex Mono", "SFMono-Regular", ui-monospace, monospace',
		fontSize: "13px",
		lineHeight: "1.7",
		padding: "0 0 24px",
	},
	".cm-content": {
		padding: "14px 16px 28px",
	},
	".cm-gutters": {
		border: "none",
		borderRight: "1px solid var(--sidebar-border)",
		backgroundColor: "var(--sidebar)",
		color: "var(--muted-foreground)",
	},
	".cm-activeLine, .cm-activeLineGutter": {
		backgroundColor: "var(--sidebar-accent)",
	},
	".cm-cursor": {
		borderLeftColor: "var(--sidebar-primary)",
	},
});

export function Editor({ value, diagnostics, isParsing, onChange }: EditorProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const initialValueRef = useRef(value);
	const viewRef = useRef<EditorView | null>(null);
	const handleChange = useEffectEvent(onChange);

	useEffect(() => {
		const parent = containerRef.current;
		if (!parent) {
			return;
		}

		const view = new EditorView({
			state: EditorState.create({
				doc: initialValueRef.current,
				extensions: [
					lineNumbers(),
					highlightActiveLineGutter(),
					drawSelection(),
					dropCursor(),
						highlightActiveLine(),
						EditorView.lineWrapping,
						sql(),
						oneDark,
						editorTheme,
						diagnosticField,
						EditorView.updateListener.of((update) => {
							if (update.docChanged) {
								handleChange(update.state.doc.toString());
						}
					}),
				],
			}),
			parent,
		});

		viewRef.current = view;

		return () => {
			view.destroy();
			viewRef.current = null;
		};
	}, []);

	useEffect(() => {
		const view = viewRef.current;
		if (!view) {
			return;
		}

		const currentValue = view.state.doc.toString();
		if (currentValue === value) {
			return;
		}

		view.dispatch({
			changes: {
				from: 0,
				to: currentValue.length,
				insert: value,
			},
		});
	}, [value]);

	useEffect(() => {
		const view = viewRef.current;
		if (!view) {
			return;
		}

		view.dispatch({
			effects: setDiagnosticsEffect.of(diagnostics),
		});
	}, [diagnostics]);

	return (
		<div
			className="dark flex h-full min-h-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground"
			aria-busy={isParsing}
		>
			{diagnostics.length > 0 ? (
				<div className="border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
					<div className="flex items-start gap-2">
						<IconAlertTriangle className="mt-0.5 size-3.5 shrink-0" />
						<div className="space-y-1">
							<p className="font-medium">Error parsing statement(s).</p>
							{diagnostics.map((diagnostic, index) => (
								<p
									key={`${diagnostic.message}-${index}`}
									className="text-destructive/90"
								>
									{diagnostic.location?.start
										? `Line ${diagnostic.location.start.line}, Col ${diagnostic.location.start.column}: `
										: ""}
									{diagnostic.message}
								</p>
							))}
						</div>
					</div>
				</div>
			) : null}
			<div className="min-h-0 flex-1">
				<div ref={containerRef} className="h-full" />
			</div>
		</div>
	);
}
