import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
	Decoration,
	EditorView,
	highlightActiveLineGutter,
	lineNumbers,
} from "@codemirror/view";
import { IconX } from "@tabler/icons-react";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import { useDiagramSession } from "@/diagram-session/diagram-session-context";
import { buildDiagnosticDecorations } from "@/lib/editor-diagnostics";
import { loadEditorLanguage } from "@/lib/editor-language";
import type { ParseDiagnostic, SchemaSourceMetadata } from "@/types";
import {
	getSchemaSourceEditorTheme,
	type SchemaSourceEditorThemeMode,
} from "@/schema-source-editor/schema-source-editor-theme";

interface SchemaSourceEditorProps {
	readonly source: string;
	readonly metadata: SchemaSourceMetadata;
	readonly diagnostics: readonly ParseDiagnostic[];
	readonly onSourceChange: (source: string) => void;
	readonly themeMode?: SchemaSourceEditorThemeMode;
}

interface SchemaSourceEditorPanelProps {
	readonly onRequestClose?: () => void;
}

const getDocumentTheme = (): SchemaSourceEditorThemeMode => {
	if (typeof document === "undefined") return "light";
	if (document.documentElement.classList.contains("dark")) return "dark";
	if (typeof window === "undefined" || !window.matchMedia) return "light";
	return window.matchMedia("(prefers-color-scheme: dark)").matches
		? "dark"
		: "light";
};

function useDocumentTheme() {
	const [themeMode, setThemeMode] = useState(getDocumentTheme);

	useEffect(() => {
		if (typeof document === "undefined") return;

		const update = () => setThemeMode(getDocumentTheme());
		const observer = new MutationObserver(update);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		const media = window.matchMedia?.("(prefers-color-scheme: dark)");
		media?.addEventListener("change", update);

		return () => {
			observer.disconnect();
			media?.removeEventListener("change", update);
		};
	}, []);

	return themeMode;
}

const editorBaseExtensions = [
	lineNumbers(),
	highlightActiveLineGutter(),
	EditorView.lineWrapping,
	EditorView.contentAttributes.of({
		"aria-label": "Schema Source",
		spellcheck: "false",
	}),
] satisfies readonly Extension[];

const emptyDiagnosticDecorations = EditorView.decorations.of(Decoration.none);

const formatDiagnosticLocation = (diagnostic: ParseDiagnostic) => {
	const start = diagnostic.location?.start;
	if (!start) return "Source";
	return `Line ${start.line}, column ${start.column}`;
};

const SchemaSourceEditor = memo(function SchemaSourceEditor({
	source,
	metadata,
	diagnostics,
	onSourceChange,
	themeMode = "light",
}: SchemaSourceEditorProps) {
	const hostRef = useRef<HTMLDivElement | null>(null);
	const viewRef = useRef<EditorView | null>(null);
	const onSourceChangeRef = useRef(onSourceChange);
	const initialSourceRef = useRef(source);
	const initialThemeModeRef = useRef(themeMode);
	const isApplyingSessionSourceRef = useRef(false);
	const languageCompartment = useMemo(() => new Compartment(), []);
	const themeCompartment = useMemo(() => new Compartment(), []);
	const diagnosticsCompartment = useMemo(() => new Compartment(), []);

	useEffect(() => {
		onSourceChangeRef.current = onSourceChange;
	}, [onSourceChange]);

	useEffect(() => {
		if (!hostRef.current) return;

		const view = new EditorView({
			parent: hostRef.current,
			state: EditorState.create({
				doc: initialSourceRef.current,
				extensions: [
					...editorBaseExtensions,
					languageCompartment.of([]),
					themeCompartment.of(
						getSchemaSourceEditorTheme(initialThemeModeRef.current),
					),
					diagnosticsCompartment.of(emptyDiagnosticDecorations),
					EditorView.updateListener.of((update) => {
						if (!update.docChanged || isApplyingSessionSourceRef.current) {
							return;
						}
						onSourceChangeRef.current(update.state.doc.toString());
					}),
				],
			}),
		});

		viewRef.current = view;
		return () => {
			view.destroy();
			viewRef.current = null;
		};
	}, [diagnosticsCompartment, languageCompartment, themeCompartment]);

	useEffect(() => {
		const view = viewRef.current;
		if (!view || view.state.doc.toString() === source) return;

		isApplyingSessionSourceRef.current = true;
		view.dispatch({
			changes: { from: 0, to: view.state.doc.length, insert: source },
		});
		isApplyingSessionSourceRef.current = false;
	}, [source]);

	useEffect(() => {
		const view = viewRef.current;
		if (!view) return;

		view.dispatch({
			effects: themeCompartment.reconfigure(
				getSchemaSourceEditorTheme(themeMode),
			),
		});
	}, [themeCompartment, themeMode]);

	useEffect(() => {
		let cancelled = false;

		void loadEditorLanguage(metadata).then((languageSupport) => {
			const view = viewRef.current;
			if (cancelled || !view) return;
			view.dispatch({
				effects: languageCompartment.reconfigure(languageSupport),
			});
		});

		return () => {
			cancelled = true;
		};
	}, [languageCompartment, metadata]);

	useEffect(() => {
		const view = viewRef.current;
		if (!view) return;

		view.dispatch({
			effects: diagnosticsCompartment.reconfigure(
				diagnostics.length === 0
					? emptyDiagnosticDecorations
					: EditorView.decorations.of(
							buildDiagnosticDecorations(view.state, diagnostics),
						),
			),
		});
	}, [diagnostics, diagnosticsCompartment]);

	return (
		<div
			ref={hostRef}
			data-testid="schema-source-editor"
			className="min-h-0 flex-1 overflow-hidden"
		/>
	);
});

export function SchemaSourceEditorPanel({
	onRequestClose,
}: SchemaSourceEditorPanelProps) {
	const source = useDiagramSession((state) => state.diagram.source);
	const metadata = useDiagramSession((state) => state.sourceMetadata);
	const diagnostics = useDiagramSession((state) => state.parseDiagnostics);
	const setSchemaSource = useDiagramSession((state) => state.setSchemaSource);
	const themeMode = useDocumentTheme();
	const diagnosticsCount = diagnostics.length;

	return (
		<aside className="flex h-full min-h-0 flex-col bg-background text-foreground">
			<div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border px-3">
				<div className="min-w-0">
					<h2 className="truncate text-sm font-semibold">Schema source</h2>
					<p className="truncate text-xs text-muted-foreground">
						{metadata.format.toUpperCase()}
						{diagnosticsCount > 0 ? ` / ${diagnosticsCount} diagnostics` : ""}
					</p>
				</div>
				{onRequestClose ? (
					<button
						type="button"
						className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
						aria-label="Close schema source editor"
						onClick={onRequestClose}
					>
						<IconX className="size-4" />
					</button>
				) : null}
			</div>
			<SchemaSourceEditor
				source={source}
				metadata={metadata}
				diagnostics={diagnostics}
				onSourceChange={setSchemaSource}
				themeMode={themeMode}
			/>
			{diagnosticsCount > 0 ? (
				<div
					data-testid="schema-source-diagnostics"
					className="max-h-36 shrink-0 overflow-auto border-t border-border bg-destructive/5 px-3 py-2"
				>
					<ul className="space-y-1">
						{diagnostics.slice(0, 3).map((diagnostic, index) => (
							<li key={index} className="text-xs text-foreground">
								<span className="font-medium text-destructive">
									{formatDiagnosticLocation(diagnostic)}
								</span>
								<span className="text-muted-foreground"> / </span>
								<span>{diagnostic.message}</span>
							</li>
						))}
					</ul>
					{diagnosticsCount > 3 ? (
						<p className="mt-1 text-xs text-muted-foreground">
							{diagnosticsCount - 3} more diagnostics
						</p>
					) : null}
				</div>
			) : null}
		</aside>
	);
}
