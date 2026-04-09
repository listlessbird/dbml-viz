import { EditorState } from "@codemirror/state";
import { Decoration } from "@codemirror/view";

import type { EditorPosition, ParseDiagnostic } from "@/types";

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

const getDiagnosticMarkRange = (
	state: EditorState,
	diagnostic: ParseDiagnostic,
) => {
	const start = diagnostic.location?.start;
	if (!start) {
		return null;
	}

	const from = getOffsetForPosition(state, start);
	const to = diagnostic.location?.end
		? getOffsetForPosition(state, diagnostic.location.end)
		: Math.min(state.doc.length, from + 1);
	const safeTo = to > from ? to : Math.min(state.doc.length, from + 1);

	return safeTo > from ? { from, to: safeTo } : null;
};

export const buildDiagnosticDecorations = (
	state: EditorState,
	diagnostics: readonly ParseDiagnostic[],
) => {
	const decorations: Array<ReturnType<typeof diagnosticMark.range>> = [];
	const highlightedLines = new Set<number>();

	for (const diagnostic of diagnostics) {
		const start = diagnostic.location?.start;
		if (!start) {
			continue;
		}

		const markRange = getDiagnosticMarkRange(state, diagnostic);
		const from = markRange?.from ?? getOffsetForPosition(state, start);
		const line = state.doc.lineAt(from);

		if (!highlightedLines.has(line.number)) {
			decorations.push(diagnosticLine.range(line.from));
			highlightedLines.add(line.number);
		}

		if (markRange) {
			decorations.push(diagnosticMark.range(markRange.from, markRange.to));
		}
	}

	decorations.sort(
		(left, right) =>
			left.from - right.from ||
			left.value.startSide - right.value.startSide ||
			left.to - right.to,
	);

	return Decoration.set(decorations);
};
