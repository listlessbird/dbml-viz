import { startTransition, useCallback, useEffect, useReducer } from "react";
import type { Dispatch, SetStateAction } from "react";

import {
	getDraftHydrationResult,
	isSameDiagramRoute,
	type DiagramRouteState,
} from "@/lib/draftPersistence";
import { SAMPLE_SCHEMA_SOURCE } from "@/lib/sample-dbml";
import {
	createInitialSchemaLoaderState,
	schemaLoaderReducer,
} from "@/lib/schemaLoaderState";
import { loadSharedSchema } from "@/lib/sharing";
import type {
	DiagramEdge,
	DiagramNode,
	DiagramNodeSize,
	DiagramPositions,
	SchemaPayload,
} from "@/types";

interface SchemaLoaderOptions {
	readonly initialSource: string;
	readonly initialPositions: DiagramPositions;
	readonly initialIsLoading: boolean;
	readonly viewedRoute: DiagramRouteState;
	readonly currentShareBaseline: SchemaPayload | null;
	readonly getDraft: (shareId: string | null) => SchemaPayload | null;
	readonly clearDraft: (shareId: string | null) => void;
	readonly setShareBaseline: Dispatch<
		SetStateAction<{ shareId: string; payload: SchemaPayload } | null>
	>;
	readonly replaceViewedRoute: (route: DiagramRouteState) => void;
	readonly requestFitView: (nodeIds?: readonly string[]) => void;
	readonly setNodes: Dispatch<SetStateAction<DiagramNode[]>>;
	readonly setEdges: Dispatch<SetStateAction<DiagramEdge[]>>;
}

export function useSchemaLoader({
	initialSource,
	initialPositions,
	initialIsLoading,
	viewedRoute,
	currentShareBaseline,
	getDraft,
	clearDraft,
	setShareBaseline,
	replaceViewedRoute,
	requestFitView,
	setNodes,
	setEdges,
}: SchemaLoaderOptions) {
	const [state, dispatch] = useReducer(
		schemaLoaderReducer,
		{
			initialSource,
			initialPositions,
			initialIsLoading,
		},
		createInitialSchemaLoaderState,
	);

	useEffect(() => {
		let cancelled = false;
		const localDraft = getDraft(viewedRoute.shareId);
		const hydration = getDraftHydrationResult({
			route: viewedRoute,
			draft: localDraft,
			sampleSource: SAMPLE_SCHEMA_SOURCE,
		});

		if (!isSameDiagramRoute(hydration.canonicalRoute, viewedRoute)) {
			replaceViewedRoute(hydration.canonicalRoute);
			return () => {
				cancelled = true;
			};
		}

		const replaceSchema = (source: string, positions: DiagramPositions) => {
			startTransition(() => {
				dispatch({
					type: "replace-schema",
					source,
					positions,
					isLoadingShare: false,
					shareLoadError: null,
				});
			});
		};

		if (hydration.remoteLoadMode === "none") {
			replaceSchema(hydration.source, hydration.positions);
			return () => {
				cancelled = true;
			};
		}

		if (hydration.remoteLoadMode === "background") {
			replaceSchema(hydration.source, hydration.positions);

			if (viewedRoute.shareId !== null && currentShareBaseline === null) {
				const sharedId = viewedRoute.shareId;

				void loadSharedSchema(sharedId)
					.then((payload) => {
						if (!cancelled) {
							setShareBaseline({ shareId: sharedId, payload });
						}
					})
					.catch(() => {});
			}

			return () => {
				cancelled = true;
			};
		}

		if (viewedRoute.shareId !== null && currentShareBaseline !== null) {
			if (hydration.clearLocalDraftOnRemoteLoad) {
				clearDraft(viewedRoute.shareId);
			}

			replaceSchema(currentShareBaseline.source, currentShareBaseline.positions);
			return () => {
				cancelled = true;
			};
		}

		startTransition(() => {
			setNodes([]);
			setEdges([]);
			dispatch({ type: "start-blocking-load" });
		});

		const sharedId = viewedRoute.shareId;
		if (sharedId === null) {
			return () => {
				cancelled = true;
			};
		}

		void loadSharedSchema(sharedId)
			.then((payload) => {
				if (cancelled) {
					return;
				}

				setShareBaseline({ shareId: sharedId, payload });
				if (hydration.clearLocalDraftOnRemoteLoad) {
					clearDraft(sharedId);
				}
				replaceSchema(payload.source, payload.positions);
				requestFitView();
			})
			.catch((error) => {
				if (cancelled) {
					return;
				}

				startTransition(() => {
					dispatch({
						type: "finish-blocking-load-error",
						message:
							error instanceof Error
								? error.message
								: "Unable to load the shared schema.",
					});
				});
				setShareBaseline(null);
			});

		return () => {
			cancelled = true;
		};
	}, [
		clearDraft,
		currentShareBaseline,
		getDraft,
		requestFitView,
		replaceViewedRoute,
		setEdges,
		setNodes,
		setShareBaseline,
		viewedRoute,
	]);

	const setSource = useCallback((source: string) => {
		dispatch({ type: "set-source", source });
	}, []);

	const setShareSeedPositions = useCallback((positions: DiagramPositions) => {
		dispatch({ type: "set-share-seed-positions", positions });
	}, []);

	const setShareLoadError = useCallback((message: string | null) => {
		dispatch({ type: "set-share-load-error", message });
	}, []);

	const recordNodeMeasurement = useCallback(
		(nodeId: string, size: DiagramNodeSize) => {
			dispatch({ type: "record-node-measurement", nodeId, size });
		},
		[],
	);

	return {
		source: state.source,
		setSource,
		shareSeedPositions: state.shareSeedPositions,
		setShareSeedPositions,
		isLoadingShare: state.isLoadingShare,
		shareLoadError: state.shareLoadError,
		setShareLoadError,
		nodeMeasurements: state.nodeMeasurements,
		recordNodeMeasurement,
	};
}
