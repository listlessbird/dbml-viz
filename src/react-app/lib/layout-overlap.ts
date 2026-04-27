import type { DiagramNode } from "@/types";

const getNodeRight = (node: Pick<DiagramNode, "position" | "width">) =>
	node.position.x + (node.width ?? 0);

const getNodeBottom = (node: Pick<DiagramNode, "height" | "position">) =>
	node.position.y + (node.height ?? 0);

export const doDiagramNodesOverlap = (
	nodes: readonly Pick<DiagramNode, "height" | "position" | "width">[],
) => {
	const sortedNodes = nodes
		.filter(
			(node) =>
				getNodeRight(node) > node.position.x &&
				getNodeBottom(node) > node.position.y,
		)
		.slice()
		.sort((left, right) => left.position.x - right.position.x);

	for (let index = 0; index < sortedNodes.length; index += 1) {
		const current = sortedNodes[index]!;
		const currentRight = getNodeRight(current);
		const currentBottom = getNodeBottom(current);

		for (
			let candidateIndex = index + 1;
			candidateIndex < sortedNodes.length;
			candidateIndex += 1
		) {
			const candidate = sortedNodes[candidateIndex]!;

			if (candidate.position.x >= currentRight) {
				break;
			}

			if (
				current.position.y < getNodeBottom(candidate) &&
				currentBottom > candidate.position.y
			) {
				return true;
			}
		}
	}

	return false;
};
