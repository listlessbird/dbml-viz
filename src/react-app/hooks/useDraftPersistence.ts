import { useEffect } from "react";

import {
	buildDraftPayload,
	isSameDiagramRoute,
	resolveDraftPersistence,
	type DiagramRouteState,
} from "@/lib/draftPersistence";
import { SAMPLE_DBML } from "@/lib/sample-dbml";
import type { DiagramNode, DiagramPositions, SchemaPayload } from "@/types";

interface DraftPersistenceOptions {
	readonly dbml: string;
	readonly nodes: readonly DiagramNode[];
	readonly shareSeedPositions: DiagramPositions;
	readonly isLoadingShare: boolean;
	readonly viewedRoute: DiagramRouteState;
	readonly currentShareBaseline: SchemaPayload | null;
	readonly clearDraft: (shareId: string | null) => void;
	readonly setDraft: (shareId: string | null, payload: SchemaPayload) => void;
	readonly replaceViewedRoute: (route: DiagramRouteState) => void;
}

export function useDraftPersistence({
	dbml,
	nodes,
	shareSeedPositions,
	isLoadingShare,
	viewedRoute,
	currentShareBaseline,
	clearDraft,
	setDraft,
	replaceViewedRoute,
}: DraftPersistenceOptions) {
	useEffect(() => {
		if (isLoadingShare) {
			return;
		}

		const payload = buildDraftPayload({
			dbml,
			nodes,
			fallbackPositions: shareSeedPositions,
		});
		const timeoutId = window.setTimeout(() => {
			const decision = resolveDraftPersistence({
				route: viewedRoute,
				payload,
				sampleDbml: SAMPLE_DBML,
				baseline: currentShareBaseline,
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
		}, 180);

		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [
		clearDraft,
		currentShareBaseline,
		dbml,
		isLoadingShare,
		nodes,
		replaceViewedRoute,
		setDraft,
		shareSeedPositions,
		viewedRoute,
	]);
}
