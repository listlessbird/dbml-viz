import { describe, expect, it } from "vitest";

import {
	deriveCanvasState,
	isSchemaSourceEmpty,
} from "@/canvas-next/canvas-empty-state/derive-canvas-state";

describe("deriveCanvasState", () => {
	it("returns empty-source when source is blank", () => {
		expect(
			deriveCanvasState({
				isSourceEmpty: true,
				diagnosticsCount: 0,
				tableCount: 0,
			}),
		).toEqual({ variant: "empty-source", diagnosticsCount: 0 });
	});

	it("returns invalid-source when diagnostics are present", () => {
		expect(
			deriveCanvasState({
				isSourceEmpty: false,
				diagnosticsCount: 3,
				tableCount: 0,
			}),
		).toEqual({ variant: "invalid-source", diagnosticsCount: 3 });
	});

	it("returns zero-tables when parse succeeds but no tables exist", () => {
		expect(
			deriveCanvasState({
				isSourceEmpty: false,
				diagnosticsCount: 0,
				tableCount: 0,
			}),
		).toEqual({ variant: "zero-tables", diagnosticsCount: 0 });
	});

	it("returns layout-pending when layout is computing on populated schema", () => {
		expect(
			deriveCanvasState({
				isSourceEmpty: false,
				diagnosticsCount: 0,
				tableCount: 5,
				isLayoutPending: true,
			}),
		).toEqual({ variant: "layout-pending", diagnosticsCount: 0 });
	});

	it("returns ready when tables exist and no layout is pending", () => {
		expect(
			deriveCanvasState({
				isSourceEmpty: false,
				diagnosticsCount: 0,
				tableCount: 5,
			}),
		).toEqual({ variant: "ready", diagnosticsCount: 0 });
	});

	it("prefers invalid-source over zero-tables when both are true", () => {
		expect(
			deriveCanvasState({
				isSourceEmpty: false,
				diagnosticsCount: 2,
				tableCount: 0,
			}).variant,
		).toBe("invalid-source");
	});
});

describe("isSchemaSourceEmpty", () => {
	it("is true for blank source", () => {
		expect(isSchemaSourceEmpty("")).toBe(true);
		expect(isSchemaSourceEmpty("   \n\t  ")).toBe(true);
	});

	it("is false for non-blank source", () => {
		expect(isSchemaSourceEmpty("Table users {}")).toBe(false);
	});
});
