import { buildCanvasProjection } from "@/canvas-next/canvas-projection";
import { getTableNodeLayout } from "@/components/table-node/layout";
import { autoLayoutDiagram } from "@/lib/layout";
import type {
	DiagramEdge,
	DiagramLayoutAlgorithm,
	DiagramNode,
	DiagramPositions,
	ParsedSchema,
	TableData,
} from "@/types";
import { placeMissingTablePositions } from "@/diagram-layout/fallback-placement";

export interface DiagramAutoLayoutRequest {
	readonly parsedSchema: ParsedSchema;
	readonly tablePositions: DiagramPositions;
	readonly algorithm: DiagramLayoutAlgorithm;
}

export interface DiagramLayoutDiagnostic {
	readonly message: string;
}

export type DiagramAutoLayoutResult =
	| {
			readonly ok: true;
			readonly tablePositions: DiagramPositions;
	  }
	| {
			readonly ok: false;
			readonly diagnostic: DiagramLayoutDiagnostic;
	  };

export type DiagramAutoLayoutAdapter = (
	nodes: readonly DiagramNode[],
	edges: readonly DiagramEdge[],
	algorithm: DiagramLayoutAlgorithm,
) => Promise<readonly DiagramNode[]>;

export interface DiagramAutoLayoutOptions {
	readonly autoLayout?: DiagramAutoLayoutAdapter;
}

export interface TableOverlapPair {
	readonly firstTableId: string;
	readonly secondTableId: string;
}

export interface TableOverlapResult {
	readonly hasOverlaps: boolean;
	readonly overlappingTableIds: readonly string[];
	readonly overlapPairs: readonly TableOverlapPair[];
}

const defaultAutoLayout: DiagramAutoLayoutAdapter = (nodes, edges, algorithm) =>
	autoLayoutDiagram(nodes, edges, algorithm);

const isDiagramNode = (node: { readonly type?: string }): node is DiagramNode =>
	node.type === "table";

const isDiagramEdge = (edge: { readonly type?: string }): edge is DiagramEdge =>
	edge.type === "relationship";

const toTablePositions = (
	nodes: readonly DiagramNode[],
): DiagramPositions => {
	const tablePositions: DiagramPositions = {};
	for (const node of nodes) {
		tablePositions[node.id] = {
			x: node.position.x,
			y: node.position.y,
		};
	}
	return tablePositions;
};

const diagnosticFromError = (error: unknown): DiagramLayoutDiagnostic => ({
	message:
		error instanceof Error
			? error.message
			: "Unable to auto-layout diagram.",
});

const tableRight = (table: TableData, position: { readonly x: number }) =>
	position.x + getTableNodeLayout(table).width;

const tableBottom = (table: TableData, position: { readonly y: number }) =>
	position.y + getTableNodeLayout(table).height;

export const detectOverlappingTablePositions = (
	parsedSchema: ParsedSchema,
	tablePositions: DiagramPositions,
): TableOverlapResult => {
	const positionedTables = parsedSchema.tables
		.flatMap((table) => {
			const position = tablePositions[table.id];
			return position ? [{ table, position }] : [];
		})
		.sort((left, right) => left.position.x - right.position.x);
	const overlapPairs: TableOverlapPair[] = [];
	const overlappingTableIds = new Set<string>();

	for (let index = 0; index < positionedTables.length; index += 1) {
		const current = positionedTables[index]!;
		const currentRight = tableRight(current.table, current.position);
		const currentBottom = tableBottom(current.table, current.position);

		for (
			let candidateIndex = index + 1;
			candidateIndex < positionedTables.length;
			candidateIndex += 1
		) {
			const candidate = positionedTables[candidateIndex]!;
			if (candidate.position.x >= currentRight) break;

			if (
				current.position.y < tableBottom(candidate.table, candidate.position) &&
				currentBottom > candidate.position.y
			) {
				overlapPairs.push({
					firstTableId: current.table.id,
					secondTableId: candidate.table.id,
				});
				overlappingTableIds.add(current.table.id);
				overlappingTableIds.add(candidate.table.id);
			}
		}
	}

	return {
		hasOverlaps: overlapPairs.length > 0,
		overlappingTableIds: Array.from(overlappingTableIds),
		overlapPairs,
	};
};

export const runDiagramAutoLayout = async (
	request: DiagramAutoLayoutRequest,
	options: DiagramAutoLayoutOptions = {},
): Promise<DiagramAutoLayoutResult> => {
	const placement = placeMissingTablePositions(
		request.parsedSchema,
		request.tablePositions,
	);
	const projection = buildCanvasProjection(
		{
			parsedSchema: request.parsedSchema,
			tablePositions: placement.tablePositions,
			stickyNotes: [],
		},
		{
			activeRelationTableIds: [],
			temporaryRelationship: null,
		},
	);
	const nodes = projection.nodes.filter(isDiagramNode);
	const edges = projection.edges.filter(isDiagramEdge);
	const autoLayout = options.autoLayout ?? defaultAutoLayout;

	try {
		const laidOutNodes = await autoLayout(nodes, edges, request.algorithm);
		return {
			ok: true,
			tablePositions: toTablePositions(laidOutNodes),
		};
	} catch (error) {
		return {
			ok: false,
			diagnostic: diagnosticFromError(error),
		};
	}
};

export const repairOverlappingTablePositions = async (
	request: DiagramAutoLayoutRequest,
	options: DiagramAutoLayoutOptions = {},
): Promise<DiagramAutoLayoutResult> => {
	const overlap = detectOverlappingTablePositions(
		request.parsedSchema,
		request.tablePositions,
	);
	if (!overlap.hasOverlaps) {
		return {
			ok: true,
			tablePositions: request.tablePositions,
		};
	}

	return runDiagramAutoLayout(request, options);
};
