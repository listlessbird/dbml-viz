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
	const getCurrentNodePositions = useEffectEvent(() => getPositionsFromNodes(nodes));
	const autoLayoutRevisionRef = useRef<number | null>(null);

	const applyAutoLayoutImpl = async ({
		positions = {},
		fitView = false,
	}: ApplyAutoLayoutArgs) => {
		const diagram = buildDiagram(parsed, {
			positions,
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
			autoLayoutRevisionRef.current = layoutRevision;
			startTransition(() => {
				setNodes(laidOutNodes);
				setEdges(diagram.edges);
			});

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
		const needsInitialAutoLayout =
			diagram.nodes.length > 0 && Object.keys(preferredPositions).length === 0;
		const needsRevisionAutoLayout =
			!hasSavedPositions &&
			diagram.nodes.length > 0 &&
			autoLayoutRevisionRef.current !== layoutRevision;

		startTransition(() => {
			setNodes(diagram.nodes);
			setEdges(diagram.edges);
		});

		if ((!needsInitialAutoLayout && !needsRevisionAutoLayout) || isLayouting) {
			return;
		}

		const frameId = window.requestAnimationFrame(() => {
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

	return { isLayouting, applyAutoLayout };
}
