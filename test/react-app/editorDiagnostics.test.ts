import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import { buildDiagnosticDecorations } from "@/lib/editor-diagnostics";

const countDecorations = (state: EditorState, diagnostics: Parameters<
	typeof buildDiagnosticDecorations
>[1]) => {
	let count = 0;
	buildDiagnosticDecorations(state, diagnostics).between(
		0,
		state.doc.length,
		() => {
			count += 1;
		},
	);
	return count;
};

describe("buildDiagnosticDecorations", () => {
	it("does not create an empty mark range for an empty document", () => {
		const state = EditorState.create({ doc: "" });

		expect(() =>
			buildDiagnosticDecorations(state, [
				{
					message: "Expected identifier",
					location: {
						start: {
							line: 1,
							column: 1,
						},
					},
				},
			]),
		).not.toThrow();
	});

	it("does not create an empty mark range when a diagnostic lands at eof", () => {
		const state = EditorState.create({ doc: "Table users {}" });

		expect(() =>
			buildDiagnosticDecorations(state, [
				{
					message: "Unexpected end of input",
					location: {
						start: {
							line: 1,
							column: state.doc.length + 1,
						},
					},
				},
			]),
		).not.toThrow();
	});

	it("skips editor decorations for diagnostics without a location", () => {
		const state = EditorState.create({ doc: "Table users {}" });

		expect(countDecorations(state, [{ message: "Parser failed" }])).toBe(0);
	});

	it("handles inverted diagnostic ranges without creating invalid decorations", () => {
		const state = EditorState.create({ doc: "Table users {}" });

		expect(() =>
			buildDiagnosticDecorations(state, [
				{
					message: "Unexpected token",
					location: {
						start: { line: 1, column: 8 },
						end: { line: 1, column: 2 },
					},
				},
			]),
		).not.toThrow();
	});
});
