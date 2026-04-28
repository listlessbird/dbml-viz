// Adapted from the Vesper VS Code theme.
// Credit: https://github.com/raunofreiberg/vesper

import {
	HighlightStyle,
	syntaxHighlighting,
} from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

const vesperColors = {
	background: "#101010",
	foreground: "#FFF",
	selection: "#1B4F9E",
	lineNumber: "#505050",
	panel: "#161616",
	input: "#1C1C1C",
	border: "#282828",
	activeLine: "rgba(255, 255, 255, 0.025)",
	listSelection: "#232323",
	accent: "#FFC799",
	accentHover: "#FFCFA8",
	muted: "#A0A0A0",
	string: "#99FFE4",
	error: "#FF8080",
	scrollbar: "#34343480",
	scrollbarHover: "#343434",
	comment: "#8b8b8b94",
} as const;

const vesperEditorTheme = EditorView.theme({
	"&": {
		height: "100%",
		color: vesperColors.foreground,
		backgroundColor: vesperColors.background,
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
		caretColor: vesperColors.accent,
	},
	".cm-cursor, .cm-dropCursor": {
		borderLeftColor: vesperColors.accent,
	},
	"&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection":
		{
			backgroundColor: vesperColors.selection,
		},
	".cm-panels": {
		backgroundColor: vesperColors.background,
		color: vesperColors.foreground,
	},
	".cm-panels.cm-panels-top": {
		borderBottom: `1px solid ${vesperColors.border}`,
	},
	".cm-panels.cm-panels-bottom": {
		borderTop: `1px solid ${vesperColors.border}`,
	},
	".cm-searchMatch": {
		backgroundColor: `${vesperColors.accent}15`,
		outline: `1px solid ${vesperColors.accent}`,
	},
	".cm-searchMatch.cm-searchMatch-selected": {
		backgroundColor: `${vesperColors.accent}25`,
	},
	".cm-activeLine": {
		backgroundColor: vesperColors.activeLine,
	},
	".cm-selectionMatch": {
		backgroundColor: vesperColors.selection,
	},
	"&.cm-focused .cm-matchingBracket": {
		backgroundColor: vesperColors.listSelection,
		outline: `1px solid ${vesperColors.accent}`,
	},
	"&.cm-focused .cm-nonmatchingBracket": {
		backgroundColor: vesperColors.listSelection,
		outline: `1px solid ${vesperColors.error}`,
	},
	".cm-gutters": {
		border: "none",
		borderRight: `1px solid ${vesperColors.border}`,
		backgroundColor: vesperColors.background,
		color: vesperColors.lineNumber,
	},
	".cm-activeLineGutter": {
		backgroundColor: vesperColors.activeLine,
		color: vesperColors.muted,
	},
	".cm-foldPlaceholder": {
		backgroundColor: vesperColors.input,
		border: `1px solid ${vesperColors.border}`,
		color: vesperColors.muted,
	},
	".cm-tooltip": {
		border: `1px solid ${vesperColors.border}`,
		backgroundColor: vesperColors.panel,
		color: vesperColors.foreground,
	},
	".cm-tooltip .cm-tooltip-arrow:before": {
		borderTopColor: "transparent",
		borderBottomColor: "transparent",
	},
	".cm-tooltip .cm-tooltip-arrow:after": {
		borderTopColor: vesperColors.panel,
		borderBottomColor: vesperColors.panel,
	},
	".cm-tooltip-autocomplete": {
		"& > ul > li[aria-selected]": {
			backgroundColor: vesperColors.listSelection,
			color: vesperColors.accent,
		},
	},
	".cm-completionMatchedText": {
		color: vesperColors.accent,
		textDecoration: "none",
	},
	".cm-scroller::-webkit-scrollbar-thumb": {
		backgroundColor: vesperColors.scrollbar,
	},
	".cm-scroller::-webkit-scrollbar-thumb:hover": {
		backgroundColor: vesperColors.scrollbarHover,
	},
}, { dark: true });

const vesperHighlightStyle = HighlightStyle.define([
	{
		tag: tags.comment,
		color: vesperColors.comment,
	},
	{
		tag: [
			tags.keyword,
			tags.modifier,
			tags.operatorKeyword,
			tags.controlKeyword,
			tags.definitionKeyword,
			tags.moduleKeyword,
			tags.self,
			tags.null,
			tags.meta,
			tags.annotation,
			tags.processingInstruction,
		],
		color: vesperColors.muted,
	},
	{
		tag: [
			tags.operator,
			tags.separator,
			tags.punctuation,
			tags.bracket,
			tags.angleBracket,
		],
		color: vesperColors.muted,
	},
	{
		tag: [
			tags.variableName,
			tags.definition(tags.variableName),
			tags.propertyName,
			tags.definition(tags.propertyName),
			tags.color,
		],
		color: vesperColors.foreground,
	},
	{
		tag: [tags.standard(tags.variableName), tags.standard(tags.propertyName)],
		color: vesperColors.muted,
	},
	{
		tag: [tags.special(tags.variableName), tags.labelName],
		color: vesperColors.error,
	},
	{
		tag: [
			tags.tagName,
			tags.function(tags.variableName),
			tags.function(tags.propertyName),
			tags.typeName,
			tags.className,
			tags.namespace,
			tags.macroName,
			tags.attributeName,
		],
		color: vesperColors.accent,
	},
	{
		tag: [
			tags.number,
			tags.integer,
			tags.float,
			tags.bool,
			tags.atom,
			tags.unit,
			tags.constant(tags.name),
			tags.literal,
		],
		color: vesperColors.accent,
	},
	{
		tag: [tags.string, tags.special(tags.string), tags.inserted, tags.attributeValue],
		color: vesperColors.string,
	},
	{
		tag: [tags.regexp, tags.escape],
		color: vesperColors.muted,
	},
	{
		tag: [tags.deleted, tags.invalid],
		color: vesperColors.error,
	},
	{
		tag: tags.changed,
		color: vesperColors.muted,
	},
	{
		tag: [tags.link, tags.url],
		color: vesperColors.accent,
		textDecoration: "underline",
	},
	{
		tag: tags.heading,
		color: vesperColors.accent,
		fontWeight: "bold",
	},
	{
		tag: tags.emphasis,
		color: vesperColors.foreground,
		fontStyle: "italic",
	},
	{
		tag: tags.strong,
		color: vesperColors.foreground,
		fontWeight: "bold",
	},
	{
		tag: tags.strikethrough,
		textDecoration: "line-through",
	},
]);

export const vesperTheme = [
	vesperEditorTheme,
	syntaxHighlighting(vesperHighlightStyle),
];
