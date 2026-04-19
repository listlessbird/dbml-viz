import {
	startTransition,
	useCallback,
	useEffect,
	useEffectEvent,
	useState,
} from "react";
import type { Dispatch, SetStateAction } from "react";
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
	readonly pruneNodeMeasurements: (nodeIds: readonly string[]) => void;
	readonly layoutAlgorithm: DiagramLayoutAlgorithm;
	readonly focusIds: readonly string[];
	readonly nodes: readonly DiagramNode[];
	readonly handleMeasure: (nodeId: string, size: DiagramNodeSize) => void;
	readonly requestFitView: (nodeIds?: readonly string[]) => void;
	readonly setNodes: Dispatch<SetStateAction<DiagramNode[]>>;
	readonly setEdges: Dispatch<SetStateAction<DiagramEdge[]>>;
}

type IdleWindow = Window &
	typeof globalThis & {
		requestIdleCallback?: (
			callback: (deadline: IdleDeadline) => void,
			options?: IdleRequestOptions,
		) => number;
		cancelIdleCallback?: (handle: number) => void;
	};

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

const scheduleWindowIdleCallback = (callback: () => void) => {
	const idleWindow = window as IdleWindow;

	if (typeof idleWindow.requestIdleCallback === "function") {
		return idleWindow.requestIdleCallback(() => callback(), { timeout: 1500 });
	}

	return window.setTimeout(callback, 250);
};

const cancelWindowIdleCallback = (handle: number) => {
	const idleWindow = window as IdleWindow;

	if (typeof idleWindow.cancelIdleCallback === "function") {
		idleWindow.cancelIdleCallback(handle);
		return;
	}

	window.clearTimeout(handle);
};

export function useDiagramSync({
	parsed,
	searchState,
	shareSeedPositions,
	nodeMeasurements,
	pruneNodeMeasurements,
	layoutAlgorithm,
	focusIds,
	nodes,
	handleMeasure,
	requestFitView,
	setNodes,
	setEdges,
}: DiagramSyncOptions) {
	const [isLayouting, setIsLayouting] = useState(false);
	const [needsMeasuredLayout, setNeedsMeasuredLayout] = useState(false);
	const getCurrentNodePositions = useEffectEvent(() => getPositionsFromNodes(nodes));
	const hasUnmeasuredNodes = parsed.tables.some((table) => !nodeMeasurements[table.id]);

	useEffect(() => {
		pruneNodeMeasurements(parsed.tables.map((table) => table.id));
	}, [parsed.tables, pruneNodeMeasurements]);

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
					requestFitView(focusIds.length > 0 ? focusIds : undefined);
				}
			} catch (error) {
				console.error(error);

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
			focusIds,
			requestFitView,
			searchState,
			setEdges,
			setNodes,
		],
	);

	// Sync diagram when parsed schema or search changes.
	useEffect(() => {
		const preferredPositions = getPreferredNodePositions(
			parsed.tables.map((table) => table.id),
			getCurrentNodePositions(),
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

		startTransition(() => {
			setNodes(diagram.nodes);
			setEdges(diagram.edges);
		});

		if (needsInitialAutoLayout && !isLayouting) {
			const frameId = window.requestAnimationFrame(() => {
				void applyAutoLayout({
					fitView: true,
					enableMeasuredFollowUp: hasUnmeasuredNodes,
				});
			});

			return () => {
				window.cancelAnimationFrame(frameId);
			};
		}

		return;
	}, [
		applyAutoLayout,
		hasUnmeasuredNodes,
		handleMeasure,
		isLayouting,
		nodeMeasurements,
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
		const idleHandle = scheduleWindowIdleCallback(() => {
			void applyAutoLayout({ fitView: true });
		});

		return () => {
			cancelWindowIdleCallback(idleHandle);
		};
	}, [applyAutoLayout, isLayouting, needsMeasuredLayout, nodeMeasurements, parsed.tables]);

	return { isLayouting, applyAutoLayout };
}
