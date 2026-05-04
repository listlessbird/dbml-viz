import { describe, expect, it } from "vitest";

import {
	measureLinksStats,
	measureProseStats,
	measureTextareaLines,
} from "@/canvas-next/sticky-note/measure";

const isAnyValid = () => true;

describe("Sticky Note measurements", () => {
	it("returns at least one prose line for empty text", () => {
		const stats = measureProseStats("", 200, isAnyValid);
		expect(stats.lineCount).toBeGreaterThanOrEqual(1);
	});

	it("counts hard newlines as separate prose blocks", () => {
		const single = measureProseStats("one", 240, isAnyValid).lineCount;
		const multi = measureProseStats("one\ntwo\nthree", 240, isAnyValid)
			.lineCount;
		expect(multi).toBe(single * 3);
	});

	it("returns zero links for an empty link list", () => {
		const stats = measureLinksStats([], 240);
		expect(stats).toEqual({ lineCount: 0, maxLineWidth: 0 });
	});

	it("measures at least one chip line when links exist", () => {
		const stats = measureLinksStats(
			[{ token: "#users", table: "users" }],
			240,
		);
		expect(stats.lineCount).toBeGreaterThanOrEqual(1);
		expect(stats.maxLineWidth).toBeGreaterThan(0);
	});

	it("returns at least one textarea line for empty text", () => {
		expect(measureTextareaLines("", 200)).toBeGreaterThanOrEqual(1);
	});
});
