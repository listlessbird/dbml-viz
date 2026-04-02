import type { DiagramEdge, DiagramNode } from "@/types";

let elkPromise: Promise<{
	layout: (graph: unknown) => Promise<{
		children?: Array<{
			id: string;
			x?: number;
			y?: number;
		}>;
	}>;
}> | null = null;

const loadElk = async () => {
	if (elkPromise === null) {
		elkPromise = import("elkjs/lib/elk.bundled.js").then(
			({ default: ELK }) => new ELK() as never,
		);
	}

	return elkPromise!;
};

const layoutOptions = {
	"elk.algorithm": "layered",
	"elk.direction": "RIGHT",
	"elk.edgeRouting": "ORTHOGONAL",
	"elk.layered.spacing.nodeNodeBetweenLayers": "120",
	"elk.spacing.nodeNode": "60",
	"org.eclipse.elk.portConstraints": "FIXED_ORDER",
} as const;

export const autoLayoutDiagram = async (
	nodes: readonly DiagramNode[],
	edges: readonly DiagramEdge[],
) => {
	if (nodes.length === 0) {
		return [];
	}

	const graph = {
		id: "dbml-root",
		layoutOptions,
		children: nodes.map((node) => ({
			id: node.id,
			width: node.width ?? 320,
			height: node.height ?? 160,
			layoutOptions: {
				"org.eclipse.elk.portConstraints": "FIXED_ORDER",
			},
			ports: node.data.table.columns.flatMap((column) => [
				{
					id: `${node.id}-${column.name}-target`,
					properties: {
						"org.eclipse.elk.port.side": "WEST",
					},
				},
				{
					id: `${node.id}-${column.name}-source`,
					properties: {
						"org.eclipse.elk.port.side": "EAST",
					},
				},
			]),
		})),
		edges: edges.map((edge) => ({
			id: edge.id,
			sources: edge.sourceHandle ? [edge.sourceHandle] : [edge.source],
			targets: edge.targetHandle ? [edge.targetHandle] : [edge.target],
		})),
	};

	const elk = await loadElk();
	const result = await elk.layout(graph as never);
	const positionedChildren = new Map(
		(result.children ?? []).map((child) => [
			child.id,
			{
				x: child.x ?? 0,
				y: child.y ?? 0,
			},
		]),
	);

	return nodes.map((node) => ({
		...node,
		position: positionedChildren.get(node.id) ?? node.position,
	}));
};
