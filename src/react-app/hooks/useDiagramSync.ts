import {
	startTransition,
	useCallback,
	useEffect,
	useEffectEvent,
	useRef,
	useState,
} from "react";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";

import { getPositionsFromNodes } from "@/lib/draftPersistence";
import { cancelIdleCallback, scheduleIdleCallback } from "@/lib/idle-callback";
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

interface ApplyAutoLayoutArgs {
	readonly positions?: DiagramPositions;
	readonly fitView?: boolean;
	readonly enableMeasuredFollowUp?: boolean;
}

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

	useEffect(() => {
		pruneNodeMeasurements(parsed.tables.map((table) => table.id));
	}, [parsed.tables, pruneNodeMeasurements]);

	const applyAutoLayoutImpl = async ({
		positions = {},
		fitView = false,
		enableMeasuredFollowUp = false,
	}: ApplyAutoLayoutArgs) => {
		const diagram = buildDiagram(parsed, {
			positions,
			measurements: nodeMeasurements,
			onMeasure: handleMeasure,
			search: createDiagramSearchContext(searchState),
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
	};

	const applyAutoLayoutRef = useRef(applyAutoLayoutImpl);
	applyAutoLayoutRef.current = applyAutoLayoutImpl;

	const applyAutoLayout = useCallback(
		(args: ApplyAutoLayoutArgs = {}) => applyAutoLayoutRef.current(args),
		[],
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

		if (!needsInitialAutoLayout || isLayouting) {
			return;
		}

		const frameId = window.requestAnimationFrame(() => {
			const hasUnmeasuredNodes = parsed.tables.some(
				(table) => !nodeMeasurements[table.id],
			);
			void applyAutoLayout({
				fitView: true,
				enableMeasuredFollowUp: hasUnmeasuredNodes,
			});
		});

		return () => {
			window.cancelAnimationFrame(frameId);
		};
	}, [
		applyAutoLayout,
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
		const idleHandle = scheduleIdleCallback(
			() => {
				void applyAutoLayout({ fitView: true });
			},
			{ timeout: 1500, fallbackDelay: 250 },
		);

		return () => {
			cancelIdleCallback(idleHandle);
		};
	}, [
		applyAutoLayout,
		isLayouting,
		needsMeasuredLayout,
		nodeMeasurements,
		parsed.tables,
	]);

	return { isLayouting, applyAutoLayout };
}
