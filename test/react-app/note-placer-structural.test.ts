import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const placerSourcePath = resolve(
	process.cwd(),
	"src/react-app/diagram-layout/note-placer.ts",
);

const FORBIDDEN_IMPORT_PATTERNS: ReadonlyArray<{
	readonly label: string;
	readonly pattern: RegExp;
}> = [
	{ label: "react", pattern: /from\s+["']react["']/ },
	{ label: "react-dom", pattern: /from\s+["']react-dom["']/ },
	{ label: "@xyflow/react", pattern: /from\s+["']@xyflow\/react["']/ },
	{ label: "@chenglou/pretext", pattern: /from\s+["']@chenglou\/pretext/ },
	{
		label: "sticky-note/measure",
		pattern: /from\s+["']@\/canvas-next\/sticky-note\/measure["']/,
	},
	{
		label: "components/table-node/layout",
		pattern: /from\s+["']@\/components\/table-node\/layout["']/,
	},
];

describe("Note Placer is a leaf Module", () => {
	const source = readFileSync(placerSourcePath, "utf-8");

	for (const forbidden of FORBIDDEN_IMPORT_PATTERNS) {
		it(`does not import ${forbidden.label}`, () => {
			expect(forbidden.pattern.test(source)).toBe(false);
		});
	}

	it("does not reference document, window, or HTMLElement", () => {
		expect(/\bdocument\b/.test(source)).toBe(false);
		expect(/\bwindow\b/.test(source)).toBe(false);
		expect(/\bHTMLElement\b/.test(source)).toBe(false);
	});
});
