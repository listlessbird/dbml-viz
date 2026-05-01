import { useDiagramDraftStore } from "@/store/useDiagramDraftStore";
import type { SchemaPayload } from "@/types";

export interface DraftPersistenceAdapter {
	readonly getDraft: (shareId: string | null) => SchemaPayload | null;
	readonly setDraft: (shareId: string | null, payload: SchemaPayload) => void;
	readonly clearDraft: (shareId: string | null) => void;
}

export function createDefaultDraftPersistenceAdapter(): DraftPersistenceAdapter {
	return {
		getDraft: (shareId) => useDiagramDraftStore.getState().getDraft(shareId),
		setDraft: (shareId, payload) =>
			useDiagramDraftStore.getState().setDraft(shareId, payload),
		clearDraft: (shareId) =>
			useDiagramDraftStore.getState().clearDraft(shareId),
	};
}
