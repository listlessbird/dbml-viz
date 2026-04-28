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

interface ElkLayoutChild {
	readonly id: string;
	readonly x?: number;
	readonly y?: number;
}

interface ElkLayoutResult {
	readonly children?: readonly ElkLayoutChild[];
}

interface ElkLayoutWorkerSuccess {
	readonly type: "success";
	readonly result: ElkLayoutResult;
}

interface ElkLayoutWorkerError {
	readonly type: "error";
	readonly message: string;
}

type ElkLayoutWorkerResponse = ElkLayoutWorkerSuccess | ElkLayoutWorkerError;

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

const runElkLayout = (graph: ElkGraph) =>
	new Promise<ElkLayoutResult>((resolve, reject) => {
		console.info("[layout] starting ELK worker");

		const worker = new Worker(new URL("../workers/elk-layout.worker.ts", import.meta.url), {
			type: "module",
		});

		const cleanup = () => {
			worker.removeEventListener("message", handleMessage);
			worker.removeEventListener("error", handleError);
			worker.removeEventListener("messageerror", handleMessageError);
			worker.terminate();
			console.info("[layout] terminated ELK worker");
		};

		const fail = (error: Error) => {
			cleanup();
			reject(error);
		};

		function handleMessage(event: MessageEvent<ElkLayoutWorkerResponse>) {
			cleanup();

			if (event.data.type === "success") {
				resolve(event.data.result);
				return;
			}

			reject(new Error(event.data.message));
		}

		function handleError(event: ErrorEvent) {
			fail(new Error(event.message || "ELK layout worker crashed."));
		}

		function handleMessageError() {
			fail(new Error("ELK layout worker returned an invalid message."));
		}

		worker.addEventListener("message", handleMessage);
		worker.addEventListener("error", handleError);
		worker.addEventListener("messageerror", handleMessageError);
		worker.postMessage({ graph });
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
	const result = await runElkLayout(graph);
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
