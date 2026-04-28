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
import { doDiagramNodesOverlap } from "@/lib/layout-overlap";
import {
	createDiagramSearchContext,
	type DiagramSearchState,
} from "@/lib/search";
import { buildDiagram } from "@/lib/transform";
import type {
	DiagramEdge,
	DiagramLayoutAlgorithm,
	DiagramNode,
	DiagramPositions,
	ParsedSchema,
} from "@/types";

interface ApplyAutoLayoutArgs {
	readonly positions?: DiagramPositions;
	readonly fitView?: boolean;
	readonly layoutAlgorithm?: DiagramLayoutAlgorithm;
}

interface DiagramSyncOptions {
	readonly parsed: ParsedSchema;
	readonly searchState: DiagramSearchState;
	readonly shareSeedPositions: DiagramPositions;
	readonly layoutAlgorithm: DiagramLayoutAlgorithm;
	readonly layoutRevision: number;
	readonly focusIds: readonly string[];
	readonly nodes: readonly DiagramNode[];
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
	layoutAlgorithm,
	layoutRevision,
	focusIds,
	nodes,
	requestFitView,
	setNodes,
	setEdges,
}: DiagramSyncOptions) {
	const [isLayouting, setIsLayouting] = useState(false);
	const [canPersistNodePositions, setCanPersistNodePositions] = useState(
		() => Object.keys(shareSeedPositions).length > 0,
	);
	const hasStableNodePositionsRef = useRef(
		Object.keys(shareSeedPositions).length > 0,
	);
	const getCurrentNodePositions = useEffectEvent(() => getPositionsFromNodes(nodes));
	const autoLayoutRevisionRef = useRef<number | null>(null);

	const applyAutoLayoutImpl = async ({
		positions = {},
		fitView = false,
		layoutAlgorithm: nextLayoutAlgorithm,
	}: ApplyAutoLayoutArgs) => {
		const requestedLayoutAlgorithm = nextLayoutAlgorithm ?? layoutAlgorithm;
		const diagram = buildDiagram(parsed, {
			positions,
			search: createDiagramSearchContext(searchState),
		});

		console.info("[layout] useDiagramSync.applyAutoLayout start", {
			requestedLayoutAlgorithm,
			layoutAlgorithmFromStore: layoutAlgorithm,
			fitView,
			providedPositionCount: Object.keys(positions).length,
			nodeCount: diagram.nodes.length,
			edgeCount: diagram.edges.length,
		});

		setIsLayouting(true);

		try {
			const { autoLayoutDiagram } = await import("@/lib/layout");
			const laidOutNodes = await autoLayoutDiagram(
				diagram.nodes,
				diagram.edges,
				requestedLayoutAlgorithm,
			);
			autoLayoutRevisionRef.current = layoutRevision;
			hasStableNodePositionsRef.current = true;
			setCanPersistNodePositions(true);
			console.info("[layout] useDiagramSync.applyAutoLayout success", {
				requestedLayoutAlgorithm,
				firstNodePositionBefore: diagram.nodes[0]?.position ?? null,
				firstNodePositionAfter: laidOutNodes[0]?.position ?? null,
			});
			setNodes(laidOutNodes);
			setEdges(diagram.edges);

			if (fitView) {
				requestFitView(focusIds.length > 0 ? focusIds : undefined);
			}
		} catch (error) {
			console.error(error);
			console.error("[layout] useDiagramSync.applyAutoLayout failed", {
				requestedLayoutAlgorithm,
				error,
			});
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

	useEffect(() => {
		const nodeIds = parsed.tables.map((table) => table.id);
		const preferredPositions = getPreferredNodePositions(
			nodeIds,
			getCurrentNodePositions(),
			shareSeedPositions,
		);
		const diagram = buildDiagram(parsed, {
			positions: preferredPositions,
			search: createDiagramSearchContext(searchState),
		});
		const hasSavedPositions = Object.keys(shareSeedPositions).length > 0;
		const hasPreferredPositions = Object.keys(preferredPositions).length > 0;
		const hasStableNodePositions = hasSavedPositions
			? true
			: hasPreferredPositions
				? hasStableNodePositionsRef.current
				: false;
		const hasKnownStablePositions =
			hasSavedPositions || (hasStableNodePositions && hasPreferredPositions);
		const hasOverlappingSavedPositions =
			hasSavedPositions && doDiagramNodesOverlap(diagram.nodes);
		const needsRecoveryAutoLayout = hasOverlappingSavedPositions;
		const needsInitialAutoLayout = !hasKnownStablePositions;

		console.info("[layout] useDiagramSync effect", {
			layoutAlgorithm,
			nodeCount: diagram.nodes.length,
			hasSavedPositions,
			hasPreferredPositions,
			hasKnownStablePositions,
			hasOverlappingSavedPositions,
			needsRecoveryAutoLayout,
			needsInitialAutoLayout,
			isLayouting,
		});

		if (hasSavedPositions) {
			hasStableNodePositionsRef.current = true;
		} else if (!hasPreferredPositions) {
			hasStableNodePositionsRef.current = true;
		}

		setCanPersistNodePositions(!hasOverlappingSavedPositions);

		startTransition(() => {
			setNodes(diagram.nodes);
			setEdges(diagram.edges);
		});

		if (
			(!needsRecoveryAutoLayout && !needsInitialAutoLayout) ||
			isLayouting
		) {
			console.info("[layout] useDiagramSync effect skip auto-layout", {
				layoutAlgorithm,
				reason: isLayouting
					? "already-layouting"
					: "no-auto-layout-needed",
			});
			return;
		}

		const frameId = window.requestAnimationFrame(() => {
			console.info("[layout] useDiagramSync effect schedule auto-layout", {
				layoutAlgorithm,
			});
			void applyAutoLayout({ fitView: true });
		});

		return () => {
			window.cancelAnimationFrame(frameId);
		};
	}, [
		applyAutoLayout,
		isLayouting,
		layoutRevision,
		parsed,
		searchState,
		setEdges,
		setNodes,
		shareSeedPositions,
	]);

	return { isLayouting, applyAutoLayout, canPersistNodePositions };
}
