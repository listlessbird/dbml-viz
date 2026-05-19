import {
	HighlightStyle,
	syntaxHighlighting,
} from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

export type SchemaSourceEditorThemeMode = "light" | "dark";

const colors = {
	keyword: "var(--muted-foreground)",
	name: "var(--foreground)",
	type: "var(--primary)",
	string: "var(--editor-syntax-string)",
	number: "var(--editor-syntax-number)",
	error: "var(--destructive)",
	comment: "var(--editor-syntax-comment)",
} as const;

const sourceHighlightStyle = HighlightStyle.define([
	{
		tag: tags.comment,
		color: colors.comment,
	},
	{
		tag: [
			tags.keyword,
			tags.modifier,
			tags.operatorKeyword,
			tags.definitionKeyword,
			tags.moduleKeyword,
			tags.null,
			tags.meta,
		],
		color: colors.keyword,
	},
	{
		tag: [tags.operator, tags.separator, tags.punctuation, tags.bracket],
		color: colors.keyword,
	},
	{
		tag: [
			tags.variableName,
			tags.definition(tags.variableName),
			tags.propertyName,
			tags.definition(tags.propertyName),
		],
		color: colors.name,
	},
	{
		tag: [tags.typeName, tags.className, tags.namespace],
		color: colors.type,
	},
	{
		tag: [tags.string, tags.special(tags.string)],
		color: colors.string,
	},
	{
		tag: [tags.number, tags.integer, tags.float, tags.bool, tags.atom],
		color: colors.number,
	},
	{
		tag: [tags.deleted, tags.invalid],
		color: colors.error,
	},
]);

const buildSurfaceTheme = (mode: SchemaSourceEditorThemeMode) => EditorView.theme({
	"&": {
		height: "100%",
		backgroundColor: "var(--background)",
		color: "var(--foreground)",
	},
	".cm-scroller": {
		fontFamily: '"IBM Plex Mono", "SFMono-Regular", ui-monospace, monospace',
		fontSize: "13px",
		lineHeight: "1.65",
		scrollbarGutter: "stable",
	},
	".cm-content": {
		minHeight: "100%",
		padding: "14px 18px 28px 12px",
		caretColor: "var(--primary)",
	},
	".cm-line": {
		padding: "0 2px",
	},
	".cm-cursor, .cm-dropCursor": {
		borderLeftColor: "var(--primary)",
	},
	".cm-selectionBackground, .cm-content ::selection": {
		backgroundColor: "var(--editor-selection)",
	},
	"&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground": {
		backgroundColor: "var(--editor-selection-focused)",
	},
	".cm-activeLine": {
		backgroundColor: "var(--editor-active-line)",
	},
	".cm-gutters": {
		backgroundColor: "var(--background)",
		borderRight: "1px solid var(--border)",
		color: "var(--muted-foreground)",
	},
	".cm-activeLineGutter": {
		backgroundColor: "var(--editor-active-line)",
		color: "var(--foreground)",
	},
	".cm-tooltip": {
		backgroundColor: "var(--popover)",
		border: "1px solid var(--border)",
		color: "var(--popover-foreground)",
	},
}, { dark: mode === "dark" });

export const getSchemaSourceEditorTheme = (
	mode: SchemaSourceEditorThemeMode,
) => [
	buildSurfaceTheme(mode),
	syntaxHighlighting(sourceHighlightStyle),
];
