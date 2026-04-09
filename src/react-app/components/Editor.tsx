import { oneDark } from "@codemirror/theme-one-dark";
import {
	Compartment,
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
import {
	IconAlertTriangle,
	IconLayoutSidebarLeftCollapse,
} from "@tabler/icons-react";
import { useEffectEvent } from "react";
import { useEffect, useRef } from "react";

import { buildDiagnosticDecorations } from "@/lib/editor-diagnostics";
import type {
	ParseDiagnostic,
	SchemaSourceMetadata,
} from "@/types";

interface EditorProps {
	readonly value: string;
	readonly diagnostics: readonly ParseDiagnostic[];
	readonly isParsing: boolean;
	readonly sourceMetadata: SchemaSourceMetadata;
	readonly onChange: (value: string) => void;
	readonly onHide: () => void;
}

const setDiagnosticsEffect = StateEffect.define<readonly ParseDiagnostic[]>();
const languageCompartment = new Compartment();
const MAX_VISIBLE_DIAGNOSTICS = 6;
const MAX_DIAGNOSTIC_MESSAGE_LENGTH = 160;

const truncateDiagnosticMessage = (message: string) =>
	message.length > MAX_DIAGNOSTIC_MESSAGE_LENGTH
		? `${message.slice(0, MAX_DIAGNOSTIC_MESSAGE_LENGTH - 1)}…`
		: message;
const getDiagnosticKey = (diagnostic: ParseDiagnostic) => {
	const start = diagnostic.location?.start;
	const end = diagnostic.location?.end;

	return [
		start ? `${start.line}:${start.column}` : "unknown",
		end ? `${end.line}:${end.column}` : "unknown",
		diagnostic.message,
	].join(":");
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
		scrollbarGutter: "stable",
	},
	".cm-content": {
		padding: "14px 18px 28px 16px",
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

export function Editor({
	value,
	diagnostics,
	isParsing,
	sourceMetadata,
	onChange,
	onHide,
}: EditorProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const initialValueRef = useRef(value);
	const viewRef = useRef<EditorView | null>(null);
	const handleChange = useEffectEvent(onChange);
	const visibleDiagnostics = diagnostics.slice(0, MAX_VISIBLE_DIAGNOSTICS);
	const hiddenDiagnosticCount = Math.max(0, diagnostics.length - visibleDiagnostics.length);

	useEffect(() => {
		const parent = containerRef.current;
		if (!parent) {
			return;
		}

		const view = new EditorView({
			state: EditorState.create({
				doc: initialValueRef.current,
				extensions: [
					languageCompartment.of([]),
					lineNumbers(),
					highlightActiveLineGutter(),
					drawSelection(),
					dropCursor(),
					highlightActiveLine(),
					EditorView.lineWrapping,
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

	useEffect(() => {
		let cancelled = false;
		const sourceFormat = sourceMetadata.format;
		const sourceDialect = sourceMetadata.dialect;

		void import("@/lib/editor-language")
			.then(({ loadEditorLanguage }) =>
				loadEditorLanguage({
					format: sourceFormat,
					dialect: sourceDialect,
				}),
			)
			.then((languageSupport) => {
				if (cancelled) {
					return;
				}

				viewRef.current?.dispatch({
					effects: languageCompartment.reconfigure(languageSupport),
				});
			})
			.catch((error) => {
				if (cancelled) {
					return;
				}

				console.error("Failed to load editor language support.", {
					scope: "editor-language",
					format: sourceFormat,
					dialect: sourceDialect,
					error:
						error instanceof Error
							? {
									name: error.name,
									message: error.message,
									stack: error.stack,
								}
							: error,
				});
			});

		return () => {
			cancelled = true;
		};
	}, [sourceMetadata.dialect, sourceMetadata.format]);

	return (
		<div
			className="dark flex h-full min-h-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground"
			aria-busy={isParsing}
		>
			<div className="flex min-h-12 items-center justify-between border-b border-sidebar-border/80 px-3 text-xs text-muted-foreground">
				<div className="flex items-center gap-2">

				</div>
				<button
					type="button"
					className="inline-flex min-h-8 items-center gap-1.5 border border-sidebar-border/70 px-2.5 text-[11px] font-medium text-sidebar-foreground transition-[background-color,border-color,color,transform] duration-200 ease-out hover:-translate-y-px hover:border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring motion-reduce:transition-none motion-reduce:hover:translate-y-0"
					onClick={onHide}
				>
					<IconLayoutSidebarLeftCollapse className="size-3.5" />
				</button>
			</div>
			{diagnostics.length > 0 ? (
				<div className="border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
					<div className="flex items-start gap-2">
						<IconAlertTriangle className="mt-0.5 size-3.5 shrink-0" />
						<div className="space-y-1">
							<p className="font-medium">Error parsing statement(s).</p>
							{visibleDiagnostics.map((diagnostic) => (
								<p
									key={getDiagnosticKey(diagnostic)}
									className="text-destructive/90"
									title={diagnostic.message}
								>
									{diagnostic.location?.start
										? `Line ${diagnostic.location.start.line}, Col ${diagnostic.location.start.column}: `
										: ""}
									{truncateDiagnosticMessage(diagnostic.message)}
								</p>
							))}
							{hiddenDiagnosticCount > 0 ? (
								<p className="text-destructive/80">
									{`${hiddenDiagnosticCount} more parser error${hiddenDiagnosticCount === 1 ? "" : "s"} hidden.`}
								</p>
							) : null}
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
