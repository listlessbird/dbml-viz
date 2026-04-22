import type {
	DiagramEdge,
	DiagramLayoutAlgorithm,
	DiagramNode,
} from "@/types";

interface ElkPort {
	readonly id: string;
	readonly properties: {
		readonly "org.eclipse.elk.port.side": "WEST" | "EAST";
	};
}

interface ElkNode {
	readonly id: string;
	readonly width: number;
	readonly height: number;
	readonly layoutOptions: {
		readonly "org.eclipse.elk.portConstraints": "FIXED_ORDER";
	};
	readonly ports: readonly ElkPort[];
}

interface ElkEdge {
	readonly id: string;
	readonly sources: readonly string[];
	readonly targets: readonly string[];
}

interface ElkGraph {
	readonly id: "dbml-root";
	readonly layoutOptions: Record<string, string>;
	readonly children: readonly ElkNode[];
	readonly edges: readonly ElkEdge[];
}

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
		console.info("[layout] loading ELK bundle");
		elkPromise = import("elkjs/lib/elk.bundled.js").then(
			({ default: ELK }) => new ELK() as never,
		);
	}

	return elkPromise!;
};

const getNodeRight = (node: Pick<DiagramNode, "position" | "width">) =>
	node.position.x + (node.width ?? 0);

const getNodeBottom = (node: Pick<DiagramNode, "height" | "position">) =>
	node.position.y + (node.height ?? 0);

export const doDiagramNodesOverlap = (
	nodes: readonly Pick<DiagramNode, "height" | "position" | "width">[],
) => {
	const sortedNodes = nodes
		.filter((node) => getNodeRight(node) > node.position.x && getNodeBottom(node) > node.position.y)
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

const buildNodePorts = (node: DiagramNode): ElkPort[] => {
	const ports = node.data.table.columns.flatMap<ElkPort>((column) => [
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
	]);

	for (const anchor of node.data.relationAnchors) {
		ports.push({
			id: anchor.id,
			properties: {
				"org.eclipse.elk.port.side": anchor.side === "target" ? "WEST" : "EAST",
			},
		});
	}

	return ports;
};

export const buildElkLayoutGraph = (
	nodes: readonly DiagramNode[],
	edges: readonly DiagramEdge[],
	algorithm: DiagramLayoutAlgorithm,
): ElkGraph => ({
	id: "dbml-root",
	layoutOptions: layoutOptionsByAlgorithm[algorithm],
	children: nodes.map((node) => ({
		id: node.id,
		width: node.width ?? 320,
		height: node.height ?? 160,
		layoutOptions: {
			"org.eclipse.elk.portConstraints": "FIXED_ORDER",
		},
		ports: buildNodePorts(node),
	})),
	edges: edges.map((edge) => ({
		id: edge.id,
		sources: edge.sourceHandle ? [edge.sourceHandle] : [edge.source],
		targets: edge.targetHandle ? [edge.targetHandle] : [edge.target],
	})),
});

export const autoLayoutDiagram = async (
	nodes: readonly DiagramNode[],
	edges: readonly DiagramEdge[],
	algorithm: DiagramLayoutAlgorithm,
) => {
	console.info("[layout] autoLayoutDiagram invoked", {
		algorithm,
		nodeCount: nodes.length,
		edgeCount: edges.length,
	});

	if (nodes.length === 0) {
		console.info("[layout] autoLayoutDiagram skipped for empty graph", {
			algorithm,
		});
		return [];
	}

	const graph = buildElkLayoutGraph(nodes, edges, algorithm);
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

	const laidOutNodes = nodes.map((node) => ({
		...node,
		position: positionedChildren.get(node.id) ?? node.position,
	}));

	console.info("[layout] autoLayoutDiagram result", {
		algorithm,
		firstNodeBefore: nodes[0]?.position ?? null,
		firstNodeAfter: laidOutNodes[0]?.position ?? null,
	});

	return laidOutNodes;
};
