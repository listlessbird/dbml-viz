import type {
	DiagramEdge,
	DiagramLayoutAlgorithm,
	DiagramNode,
} from "@/types";

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

export const LAYOUT_ALGORITHM_OPTIONS = [
	{
		id: "left-right",
		label: "Left-right",
		description: "Arrange tables from left to right based on relationship flow.",
	},
	{
		id: "snowflake",
		label: "Snowflake",
		description: "Spread connected tables around dense hubs for star-like schemas.",
	},
	{
		id: "compact",
		label: "Compact",
		description: "Pack the diagram into a tighter block for shorter overviews.",
	},
] as const satisfies ReadonlyArray<{
	id: DiagramLayoutAlgorithm;
	label: string;
	description: string;
}>;

const layoutOptionsByAlgorithm: Record<
	DiagramLayoutAlgorithm,
	Record<string, string>
> = {
	"left-right": {
		"elk.algorithm": "layered",
		"elk.direction": "RIGHT",
		"elk.edgeRouting": "ORTHOGONAL",
		"elk.layered.spacing.nodeNodeBetweenLayers": "136",
		"elk.spacing.nodeNode": "68",
		"org.eclipse.elk.portConstraints": "FIXED_ORDER",
	},
	snowflake: {
		"elk.algorithm": "force",
		"elk.spacing.nodeNode": "92",
		"org.eclipse.elk.portConstraints": "FIXED_ORDER",
	},
	compact: {
		"elk.algorithm": "layered",
		"elk.direction": "DOWN",
		"elk.edgeRouting": "ORTHOGONAL",
		"elk.layered.spacing.nodeNodeBetweenLayers": "84",
		"elk.spacing.nodeNode": "36",
		"org.eclipse.elk.portConstraints": "FIXED_ORDER",
	},
};

export const autoLayoutDiagram = async (
	nodes: readonly DiagramNode[],
	edges: readonly DiagramEdge[],
	algorithm: DiagramLayoutAlgorithm,
) => {
	if (nodes.length === 0) {
		return [];
	}

	const graph = {
		id: "dbml-root",
		layoutOptions: layoutOptionsByAlgorithm[algorithm],
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
