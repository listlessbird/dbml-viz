import { startTransition, useCallback, useEffect, useState } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { toast } from "sonner";

import { getPositionsFromNodes } from "@/lib/draftPersistence";
import {
	createDiagramSearchContext,
	type DiagramSearchState,
} from "@/lib/search";
import { buildDiagram } from "@/lib/transform";
import type {
	DiagramEdge,
	DiagramLayoutAlgorithm,
	DiagramNode,
	DiagramNodeSize,
	DiagramPositions,
	ParsedSchema,
} from "@/types";

interface DiagramSyncOptions {
	readonly parsed: ParsedSchema;
	readonly searchState: DiagramSearchState;
	readonly shareSeedPositions: DiagramPositions;
	readonly nodeMeasurements: Record<string, DiagramNodeSize>;
	readonly layoutAlgorithm: DiagramLayoutAlgorithm;
	readonly searchFocusIds: readonly string[];
	readonly nodesRef: MutableRefObject<DiagramNode[]>;
	readonly handleMeasure: (nodeId: string, size: DiagramNodeSize) => void;
	readonly requestFitView: (nodeIds?: readonly string[]) => void;
	readonly setNodes: Dispatch<SetStateAction<DiagramNode[]>>;
	readonly setEdges: Dispatch<SetStateAction<DiagramEdge[]>>;
}

const getPreferredNodePositions = (
	nodeIds: readonly string[],
	currentPositions: DiagramPositions,
	seedPositions: DiagramPositions,
) =>
	Object.fromEntries(
		nodeIds.flatMap((nodeId) => {
			const position = currentPositions[nodeId] ?? seedPositions[nodeId];
			return position ? [[nodeId, position]] : [];
		}),
	);

export function useDiagramSync({
	parsed,
	searchState,
	shareSeedPositions,
	nodeMeasurements,
	layoutAlgorithm,
	searchFocusIds,
	nodesRef,
	handleMeasure,
	requestFitView,
	setNodes,
	setEdges,
}: DiagramSyncOptions) {
	const [isLayouting, setIsLayouting] = useState(false);
	const [needsMeasuredLayout, setNeedsMeasuredLayout] = useState(false);

	const applyAutoLayout = useCallback(
		async ({
			positions = {},
			fitView = false,
			enableMeasuredFollowUp = false,
		}: {
			positions?: DiagramPositions;
			fitView?: boolean;
			enableMeasuredFollowUp?: boolean;
		}) => {
			const searchContext = createDiagramSearchContext(searchState);
			const diagram = buildDiagram(parsed, {
				positions,
				measurements: nodeMeasurements,
				onMeasure: handleMeasure,
				search: searchContext,
			});

			setIsLayouting(true);

			try {
				const { autoLayoutDiagram } = await import("@/lib/layout");
				const laidOutNodes = await autoLayoutDiagram(
					diagram.nodes,
					diagram.edges,
					layoutAlgorithm,
				);
				startTransition(() => {
					setNodes(laidOutNodes);
					setEdges(diagram.edges);
				});
				setNeedsMeasuredLayout(enableMeasuredFollowUp);

				if (fitView) {
					requestFitView(searchFocusIds.length > 0 ? searchFocusIds : undefined);
				}
			} catch (error) {
				toast.error(
					error instanceof Error ? error.message : "Unable to auto-layout schema.",
				);
			} finally {
				setIsLayouting(false);
			}
		},
		[
			handleMeasure,
			layoutAlgorithm,
			nodeMeasurements,
			parsed,
			requestFitView,
			searchState,
			searchFocusIds,
			setEdges,
			setNodes,
		],
	);

	// Sync diagram when parsed schema or search changes.
	useEffect(() => {
		const preferredPositions = getPreferredNodePositions(
			parsed.tables.map((table) => table.id),
			getPositionsFromNodes(nodesRef.current),
			shareSeedPositions,
		);
		const diagram = buildDiagram(parsed, {
			positions: preferredPositions,
			measurements: nodeMeasurements,
			onMeasure: handleMeasure,
			search: createDiagramSearchContext(searchState),
		});
		const needsInitialAutoLayout =
			diagram.nodes.length > 0 && Object.keys(preferredPositions).length === 0;

		if (needsInitialAutoLayout) {
			void applyAutoLayout({
				fitView: true,
				enableMeasuredFollowUp:
					Object.keys(nodeMeasurements).length < parsed.tables.length,
			});
			return;
		}

		startTransition(() => {
			setNodes(diagram.nodes);
			setEdges(diagram.edges);
		});
	}, [
		applyAutoLayout,
		handleMeasure,
		nodeMeasurements,
		nodesRef,
		parsed,
		searchState,
		setEdges,
		setNodes,
		shareSeedPositions,
	]);

	// Re-layout once all nodes are measured.
	useEffect(() => {
		if (!needsMeasuredLayout || isLayouting || parsed.tables.length === 0) {
			return;
		}

		const allMeasured = parsed.tables.every((table) => nodeMeasurements[table.id]);
		if (!allMeasured) {
			return;
		}

		setNeedsMeasuredLayout(false);
		void applyAutoLayout({ fitView: true });
	}, [applyAutoLayout, isLayouting, needsMeasuredLayout, nodeMeasurements, parsed.tables]);

	return { isLayouting, applyAutoLayout };
}
