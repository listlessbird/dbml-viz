import { useContext, useEffect } from "react";

import { useDraftPersistenceAdapter } from "@/canvas-next/diagram-persistence-context";
import { DiagramSessionContext } from "@/diagram-session/diagram-session-context";
import {
	isSameDiagramRoute,
	resolveDraftPersistence,
	type DiagramRouteState,
} from "@/lib/draftPersistence";
import { SAMPLE_SCHEMA_SOURCE } from "@/lib/sample-dbml";
import type { SchemaPayload } from "@/types";

const DRAFT_DEBOUNCE_MS = 180;

const ROOT_ROUTE = Object.freeze({ shareId: null, isDirty: false });

export interface UseDraftPersistenceOptions {
	readonly debounceMs?: number;
	readonly route?: DiagramRouteState;
	readonly currentShareBaseline?: SchemaPayload | null;
	readonly onRouteDecision?: (route: DiagramRouteState) => void;
}

export function useDraftPersistence({
	debounceMs = DRAFT_DEBOUNCE_MS,
	route = ROOT_ROUTE,
	currentShareBaseline = null,
	onRouteDecision,
}: UseDraftPersistenceOptions = {}) {
	const adapter = useDraftPersistenceAdapter();
	const sessionStore = useContext(DiagramSessionContext);
	if (!sessionStore) {
		throw new Error(
			"useDraftPersistence must be used inside DiagramSessionProvider",
		);
	}

	useEffect(() => {
		let timeoutId: number | undefined;

		const flush = () => {
			const payload = sessionStore.getState().toSchemaPayload();
			const decision = resolveDraftPersistence({
				route,
				payload,
				sampleSource: SAMPLE_SCHEMA_SOURCE,
				baseline: currentShareBaseline,
				rootBaseline: null,
			});

			if (decision.shouldClearDraft) {
				adapter.clearDraft(route.shareId);
			}
			if (decision.shouldStoreDraft) {
				adapter.setDraft(route.shareId, payload);
			}
			if (!isSameDiagramRoute(decision.nextRoute, route)) {
				onRouteDecision?.(decision.nextRoute);
			}
		};

		const schedule = () => {
			if (timeoutId !== undefined) {
				window.clearTimeout(timeoutId);
			}
			timeoutId = window.setTimeout(flush, debounceMs);
		};

		const unsubscribe = sessionStore.subscribe((state, previous) => {
			if (state.diagram === previous.diagram) return;
			schedule();
		});

		return () => {
			if (timeoutId !== undefined) {
				window.clearTimeout(timeoutId);
			}
			unsubscribe();
		};
	}, [
		adapter,
		sessionStore,
		debounceMs,
		route,
		currentShareBaseline,
		onRouteDecision,
	]);
}
