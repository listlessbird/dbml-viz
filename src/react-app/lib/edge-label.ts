/**
 * Computes edge label position by sampling a point on the actual SVG path
 * near the target end, so labels stay close to the target table.
 */

export interface PathLike {
	getTotalLength(): number;
	getPointAtLength(length: number): { x: number; y: number };
}

export function samplePathPoint(
	path: PathLike,
	offsetFromEnd: number,
): { x: number; y: number } {
	const total = path.getTotalLength();
	const at = Math.max(0, total - offsetFromEnd);
	const pt = path.getPointAtLength(at);
	return { x: pt.x, y: pt.y };
}

const reusablePath =
	typeof document !== "undefined"
		? document.createElementNS("http://www.w3.org/2000/svg", "path")
		: null;

export function sampleEdgeLabelPosition(
	d: string,
	offsetFromEnd: number,
): { x: number; y: number } {
	if (!reusablePath) {
		return { x: 0, y: 0 };
	}
	reusablePath.setAttribute("d", d);
	return samplePathPoint(reusablePath, offsetFromEnd);
}
