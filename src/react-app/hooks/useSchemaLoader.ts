import { startTransition, useCallback, useEffect, useMemo, useReducer } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useQuery } from "@tanstack/react-query";

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
import { loadSharedSchema, sharedSchemaQueryKey } from "@/lib/sharing";
import { useStickyNotesStore } from "@/store/useStickyNotesStore";
import type {
	DiagramEdge,
	DiagramNode,
	DiagramPositions,
	SchemaPayload,
	SharedStickyNote,
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

	const hydration = useMemo(() => {
		const localDraft = getDraft(viewedRoute.shareId);
		return getDraftHydrationResult({
			route: viewedRoute,
			draft: localDraft,
			sampleSource: SAMPLE_SCHEMA_SOURCE,
		});
	}, [getDraft, viewedRoute]);

	const shouldLoadSharedSchema =
		viewedRoute.shareId !== null &&
		currentShareBaseline === null &&
		hydration.remoteLoadMode !== "none";

	const sharedSchemaQuery = useQuery({
		queryKey: sharedSchemaQueryKey(viewedRoute.shareId ?? ""),
		queryFn: () => {
			if (viewedRoute.shareId === null) {
				throw new Error("A shared schema id is required.");
			}
			return loadSharedSchema(viewedRoute.shareId);
		},
		enabled: shouldLoadSharedSchema,
	});

	useEffect(() => {
		if (!isSameDiagramRoute(hydration.canonicalRoute, viewedRoute)) {
			replaceViewedRoute(hydration.canonicalRoute);
			return;
		}

		const replaceSchema = (
			source: string,
			positions: DiagramPositions,
			notes: readonly SharedStickyNote[],
		) => {
			useStickyNotesStore.getState().hydrate(notes);
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
			replaceSchema(hydration.source, hydration.positions, hydration.notes);
			return;
		}

		if (hydration.remoteLoadMode === "background") {
			replaceSchema(hydration.source, hydration.positions, hydration.notes);

			if (viewedRoute.shareId !== null && currentShareBaseline === null) {
				if (sharedSchemaQuery.data) {
					setShareBaseline({
						shareId: viewedRoute.shareId,
						payload: sharedSchemaQuery.data,
					});
				} else if (sharedSchemaQuery.error) {
					console.error(sharedSchemaQuery.error);
				}
			}

			return;
		}

		if (viewedRoute.shareId !== null && currentShareBaseline !== null) {
			if (hydration.clearLocalDraftOnRemoteLoad) {
				clearDraft(viewedRoute.shareId);
			}

			replaceSchema(
				currentShareBaseline.source,
				currentShareBaseline.positions,
				currentShareBaseline.notes,
			);
			return;
		}

		startTransition(() => {
			setNodes([]);
			setEdges([]);
			useStickyNotesStore.getState().clear();
			dispatch({ type: "start-blocking-load" });
		});

		const sharedId = viewedRoute.shareId;
		if (sharedId === null) {
			return;
		}

		if (sharedSchemaQuery.isPending || sharedSchemaQuery.isFetching) {
			return;
		}

		if (sharedSchemaQuery.data) {
			setShareBaseline({ shareId: sharedId, payload: sharedSchemaQuery.data });
			if (hydration.clearLocalDraftOnRemoteLoad) {
				clearDraft(sharedId);
			}
			replaceSchema(
				sharedSchemaQuery.data.source,
				sharedSchemaQuery.data.positions,
				sharedSchemaQuery.data.notes,
			);
			requestFitView();
			return;
		}

		if (sharedSchemaQuery.error) {
			console.error(sharedSchemaQuery.error);

			startTransition(() => {
				dispatch({
					type: "finish-blocking-load-error",
					message:
						sharedSchemaQuery.error instanceof Error
							? sharedSchemaQuery.error.message
							: "Unable to load the shared schema.",
				});
			});
			setShareBaseline(null);
		}

		return;
	}, [
		clearDraft,
		currentShareBaseline,
		hydration,
		requestFitView,
		replaceViewedRoute,
		setEdges,
		setNodes,
		setShareBaseline,
		sharedSchemaQuery.data,
		sharedSchemaQuery.error,
		sharedSchemaQuery.isFetching,
		sharedSchemaQuery.isPending,
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

	return {
		source: state.source,
		setSource,
		shareSeedPositions: state.shareSeedPositions,
		setShareSeedPositions,
		isLoadingShare: state.isLoadingShare,
		shareLoadError: state.shareLoadError,
		setShareLoadError,
	};
}
