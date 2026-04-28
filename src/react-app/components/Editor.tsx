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
	IconBrandGithub,
	IconLayoutSidebarLeftCollapse,
	IconLock,
	IconLockOpen,
} from "@tabler/icons-react";
import { useEffectEvent } from "react";
import { useEffect, useRef } from "react";

import { EditorOverlays } from "@/components/agent-connectivity/EditorOverlays";
import { EditorTitleStatus } from "@/components/agent-connectivity/EditorTitleStatus";
import { buildDiagnosticDecorations } from "@/lib/editor-diagnostics";
import { vesperTheme } from "@/lib/vesper-theme";
import type {
	ParseDiagnostic,
	SchemaSourceMetadata,
} from "@/types";

interface EditorProps {
	readonly value: string;
	readonly diagnostics: readonly ParseDiagnostic[];
	readonly isParsing: boolean;
	readonly sourceMetadata: SchemaSourceMetadata;
	readonly readOnly?: boolean;
	readonly onChange: (value: string) => void;
	readonly onHide: () => void;
}

const setDiagnosticsEffect = StateEffect.define<readonly ParseDiagnostic[]>();
const languageCompartment = new Compartment();
const editabilityCompartment = new Compartment();
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

interface EditorLockIndicatorProps {
	readonly locked: boolean;
}

function EditorLockIndicator({ locked }: EditorLockIndicatorProps) {
	const Icon = locked ? IconLock : IconLockOpen;

	return (
		<span
			className={[
				"inline-flex size-5 shrink-0 items-center justify-center border bg-[var(--gray-800)]",
				locked
					? "border-[oklch(0.52_0.13_58_/_0.55)] text-[oklch(0.76_0.14_62)]"
					: "border-white/10 text-[var(--gray-500)]",
			].join(" ")}
			title={locked ? "Editor is locked when connected to an agent" : "Editor unlocked"}
			aria-label={locked ? "Editor locked" : "Editor unlocked"}
		>
			<Icon className="size-3" strokeWidth={2} />
		</span>
	);
}

export function Editor({
	value,
	diagnostics,
	isParsing,
	sourceMetadata,
	readOnly = false,
	onChange,
	onHide,
}: EditorProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const initialValueRef = useRef(value);
	const initialReadOnlyRef = useRef(readOnly);
	const viewRef = useRef<EditorView | null>(null);
	const readOnlyRef = useRef(readOnly);
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
					editabilityCompartment.of([
						EditorState.readOnly.of(initialReadOnlyRef.current),
						EditorView.editable.of(!initialReadOnlyRef.current),
					]),
					lineNumbers(),
					highlightActiveLineGutter(),
					drawSelection(),
					dropCursor(),
					highlightActiveLine(),
					EditorView.lineWrapping,
					vesperTheme,
					diagnosticField,
					EditorView.updateListener.of((update) => {
						if (update.docChanged && !readOnlyRef.current) {
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
		readOnlyRef.current = readOnly;
		if (!view) {
			return;
		}

		view.dispatch({
			effects: editabilityCompartment.reconfigure([
				EditorState.readOnly.of(readOnly),
				EditorView.editable.of(!readOnly),
			]),
		});
	}, [readOnly]);

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

	const lineCount = value.split("\n").length;
	const formatLabel = sourceMetadata.format === "sql"
		? sourceMetadata.dialect
			? sourceMetadata.dialect.toUpperCase()
			: "SQL"
		: "DBML";

	return (
		<div
			className="dark flex h-full min-h-0 flex-col overflow-hidden bg-sidebar text-sidebar-foreground"
			aria-busy={isParsing}
		>
			<div className="flex min-h-10 items-center justify-between gap-3 border-b border-sidebar-border/80 px-3">
				<div className="flex min-w-0 items-center gap-3">
					<div className="inline-flex shrink-0 items-center gap-1.5">
						<span className="inline-flex items-center gap-0 text-[11px] font-medium bg-[var(--gray-800)] border border-white/10 text-[var(--gray-100)] px-2.5 py-1 leading-none">
							schema.dbml
						</span>
						<EditorLockIndicator locked={readOnly} />
					</div>
					<EditorTitleStatus />
				</div>
				<button
					type="button"
					className="inline-flex size-[26px] items-center justify-center border border-white/[0.14] bg-transparent text-[var(--gray-400)] transition-[border-color,color] duration-[120ms] ease-[cubic-bezier(0.215,0.61,0.355,1)] hover:border-white/[0.28] hover:text-[var(--gray-0)] focus-visible:outline-none"
					style={{ height: 24, width: 26 }}
					onClick={onHide}
					title="Hide editor"
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
			<div className="relative min-h-0 flex-1">
				<div ref={containerRef} className="h-full" />
				<EditorOverlays />
			</div>
			<div
				className="flex shrink-0 items-center gap-3.5 border-t border-white/10 px-3.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[var(--gray-400)]"
				style={{ background: "color-mix(in oklab, #000 20%, var(--gray-900))" }}
			>
				<span>{formatLabel}</span>
				<span>{lineCount} {lineCount === 1 ? "line" : "lines"}</span>
				<a
					href="https://github.com/listlessbird/dbml-viz"
					target="_blank"
					rel="noopener noreferrer"
					title="View source on GitHub"
					className="ml-auto inline-flex items-center justify-center text-[var(--gray-500)] transition-colors normal-case hover:text-[var(--gray-200)]"
				>
					<IconBrandGithub className="size-3.5" />
				</a>
			</div>
		</div>
	);
}
