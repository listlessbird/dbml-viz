import { useContext, useEffect } from "react";

import { useDraftPersistenceAdapter } from "@/canvas-next/diagram-persistence-context";
import { DiagramSessionContext } from "@/diagram-session/diagram-session-context";
import { resolveDraftPersistence } from "@/lib/draftPersistence";
import { SAMPLE_SCHEMA_SOURCE } from "@/lib/sample-dbml";

const DRAFT_DEBOUNCE_MS = 180;

const ROOT_ROUTE = Object.freeze({ shareId: null, isDirty: false });

export interface UseDraftPersistenceOptions {
	readonly debounceMs?: number;
}

export function useDraftPersistence({
	debounceMs = DRAFT_DEBOUNCE_MS,
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
				route: ROOT_ROUTE,
				payload,
				sampleSource: SAMPLE_SCHEMA_SOURCE,
				baseline: null,
				rootBaseline: null,
			});

			if (decision.shouldClearDraft) {
				adapter.clearDraft(ROOT_ROUTE.shareId);
			}
			if (decision.shouldStoreDraft) {
				adapter.setDraft(ROOT_ROUTE.shareId, payload);
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
	}, [adapter, sessionStore, debounceMs]);
}
