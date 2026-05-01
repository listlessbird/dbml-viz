import { useDiagramDraftStore } from "@/store/useDiagramDraftStore";
import type { SchemaPayload } from "@/types";
import { loadSharedSchema, saveSharedSchema } from "@/lib/sharing";

export interface DraftPersistenceAdapter {
	readonly getDraft: (shareId: string | null) => SchemaPayload | null;
	readonly setDraft: (shareId: string | null, payload: SchemaPayload) => void;
	readonly clearDraft: (shareId: string | null) => void;
}

export interface DiagramPersistenceAdapter extends DraftPersistenceAdapter {
	readonly loadShare: (shareId: string) => Promise<unknown>;
	readonly saveShare: (
		payload: SchemaPayload,
	) => Promise<{ readonly id: string }>;
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

export function createDefaultDiagramPersistenceAdapter(): DiagramPersistenceAdapter {
	return {
		...createDefaultDraftPersistenceAdapter(),
		loadShare: loadSharedSchema,
		saveShare: saveSharedSchema,
	};
}

export function withSharePersistenceAdapter(
	adapter?: DraftPersistenceAdapter | DiagramPersistenceAdapter,
): DiagramPersistenceAdapter {
	const fallback = createDefaultDiagramPersistenceAdapter();
	return {
		...fallback,
		...adapter,
	};
}
