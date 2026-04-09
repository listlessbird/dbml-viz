import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";

import { buildDiagnosticDecorations } from "@/lib/editor-diagnostics";

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
});
