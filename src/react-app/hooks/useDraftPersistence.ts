import { useEffect } from "react";

import {
	buildDraftPayload,
	isSameDiagramRoute,
	resolveDraftPersistence,
	type DiagramRouteState,
} from "@/lib/draftPersistence";
import { SAMPLE_SCHEMA_SOURCE } from "@/lib/sample-dbml";
import {
	getSharedStickyNotes,
	useStickyNotesStore,
} from "@/store/useStickyNotesStore";
import type { DiagramNode, DiagramPositions, SchemaPayload } from "@/types";

const DRAFT_DEBOUNCE_MS = 180;

interface DraftPersistenceOptions {
	readonly source: string;
	readonly nodes: readonly DiagramNode[];
	readonly canPersistNodePositions: boolean;
	readonly shareSeedPositions: DiagramPositions;
	readonly isLoadingShare: boolean;
	readonly viewedRoute: DiagramRouteState;
	readonly currentShareBaseline: SchemaPayload | null;
	readonly rootSampleBaseline: SchemaPayload | null;
	readonly clearDraft: (shareId: string | null) => void;
	readonly setDraft: (shareId: string | null, payload: SchemaPayload) => void;
	readonly replaceViewedRoute: (route: DiagramRouteState) => void;
}

export function useDraftPersistence({
	source,
	nodes,
	canPersistNodePositions,
	shareSeedPositions,
	isLoadingShare,
	viewedRoute,
	currentShareBaseline,
	rootSampleBaseline,
	clearDraft,
	setDraft,
	replaceViewedRoute,
}: DraftPersistenceOptions) {
	useEffect(() => {
		if (isLoadingShare) {
			return;
		}

		let timeoutId: number | undefined;

		const flush = () => {
			const payload = buildDraftPayload({
				source,
				nodes: canPersistNodePositions ? nodes : [],
				fallbackPositions: shareSeedPositions,
				notes: getSharedStickyNotes(),
			});
			const decision = resolveDraftPersistence({
				route: viewedRoute,
				payload,
				sampleSource: SAMPLE_SCHEMA_SOURCE,
				baseline: currentShareBaseline,
				rootBaseline: rootSampleBaseline,
			});

			if (!isSameDiagramRoute(decision.nextRoute, viewedRoute)) {
				replaceViewedRoute(decision.nextRoute);
			}

			if (decision.shouldClearDraft) {
				clearDraft(viewedRoute.shareId);
			}

			if (decision.shouldStoreDraft) {
				setDraft(viewedRoute.shareId, payload);
			}
		};

		const schedule = () => {
			if (timeoutId !== undefined) {
				window.clearTimeout(timeoutId);
			}
			timeoutId = window.setTimeout(flush, DRAFT_DEBOUNCE_MS);
		};

		schedule();
		const unsubscribe = useStickyNotesStore.subscribe(schedule);

		return () => {
			if (timeoutId !== undefined) {
				window.clearTimeout(timeoutId);
			}
			unsubscribe();
		};
	}, [
		clearDraft,
		currentShareBaseline,
		rootSampleBaseline,
		source,
		canPersistNodePositions,
		isLoadingShare,
		nodes,
		replaceViewedRoute,
		setDraft,
		shareSeedPositions,
		viewedRoute,
	]);
}
