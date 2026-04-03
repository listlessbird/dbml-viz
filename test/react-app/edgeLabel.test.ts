import { describe, expect, it } from "vitest";

import { samplePathPoint, type PathLike } from "@/lib/edge-label";

/**
 * Minimal mock that simulates a straight horizontal path from (0,0) to (totalLen, 0).
 */
function mockStraightPath(totalLen: number): PathLike {
	return {
		getTotalLength: () => totalLen,
		getPointAtLength: (len: number) => ({
			x: Math.min(Math.max(len, 0), totalLen),
			y: 0,
		}),
	};
}

/**
 * Mock that simulates an L-shaped path: horizontal from (0,0) to (hLen, 0),
 * then vertical from (hLen, 0) to (hLen, vLen).
 */
function mockLShapedPath(hLen: number, vLen: number): PathLike {
	const total = hLen + vLen;
	return {
		getTotalLength: () => total,
		getPointAtLength: (len: number) => {
			const clamped = Math.min(Math.max(len, 0), total);
			if (clamped <= hLen) {
				return { x: clamped, y: 0 };
			}
			return { x: hLen, y: clamped - hLen };
		},
	};
}

describe("samplePathPoint", () => {
	it("returns the target end when offsetFromEnd is 0", () => {
		const path = mockStraightPath(200);
		const point = samplePathPoint(path, 0);
		expect(point.x).toBe(200);
		expect(point.y).toBe(0);
	});

	it("returns a point near the target for a small offset", () => {
		const path = mockStraightPath(200);
		const point = samplePathPoint(path, 40);
		expect(point.x).toBe(160);
		expect(point.y).toBe(0);
	});

	it("clamps to the start when offset exceeds total length", () => {
		const path = mockStraightPath(20);
		const point = samplePathPoint(path, 40);
		expect(point.x).toBe(0);
		expect(point.y).toBe(0);
	});

	it("stays near target on a long path (the original bug scenario)", () => {
		// Simulates a very long edge — 1000px. The label should be at 960, not 500.
		const path = mockStraightPath(1000);
		const point = samplePathPoint(path, 40);
		expect(point.x).toBe(960);
		expect(point.y).toBe(0);
	});

	it("works on an L-shaped path with offset landing on the vertical segment", () => {
		// Horizontal 100px, vertical 200px. Total 300. Offset 40 → sample at 260.
		// 260 > 100, so on vertical segment: x = 100, y = 260 - 100 = 160
		const path = mockLShapedPath(100, 200);
		const point = samplePathPoint(path, 40);
		expect(point.x).toBe(100);
		expect(point.y).toBe(160);
	});

	it("works on an L-shaped path with offset landing on the horizontal segment", () => {
		// Horizontal 100px, vertical 50px. Total 150. Offset 80 → sample at 70.
		// 70 <= 100, so on horizontal segment: x = 70, y = 0
		const path = mockLShapedPath(100, 50);
		const point = samplePathPoint(path, 80);
		expect(point.x).toBe(70);
		expect(point.y).toBe(0);
	});

	it("label position differs from midpoint on a long path", () => {
		// The whole point: on a 1000px path, midpoint is at 500 but our label is at 960.
		const path = mockStraightPath(1000);
		const midpoint = samplePathPoint(path, 500);
		const label = samplePathPoint(path, 40);
		expect(label.x).toBeGreaterThan(midpoint.x);
	});
});
