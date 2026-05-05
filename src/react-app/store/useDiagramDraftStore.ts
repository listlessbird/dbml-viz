import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { areSchemaPayloadsEqual } from "@/lib/draftPersistence";
import { parseSchemaPayload } from "@/lib/schema-payload";
import type { SchemaPayload } from "@/types";

const LOCAL_DRAFT_STORAGE_PREFIX = "dbml-viz:local-draft:";

const getDraftKey = (shareId: string | null) =>
	`${LOCAL_DRAFT_STORAGE_PREFIX}${shareId ?? "root"}`;

interface DiagramDraftState {
	readonly drafts: Record<string, unknown>;
	readonly getDraft: (shareId: string | null) => SchemaPayload | null;
	readonly setDraft: (shareId: string | null, payload: SchemaPayload) => void;
	readonly clearDraft: (shareId: string | null) => void;
}

export const useDiagramDraftStore = create<DiagramDraftState>()(
	persist(
		(set, get) => ({
			drafts: {},
			getDraft: (shareId) => {
				const draft = get().drafts[getDraftKey(shareId)];
				return draft ? parseSchemaPayload(draft) : null;
			},
			setDraft: (shareId, payload) => {
				set((state) => {
					const draftKey = getDraftKey(shareId);
					const currentDraft = parseSchemaPayload(state.drafts[draftKey]);

					if (currentDraft && areSchemaPayloadsEqual(currentDraft, payload)) {
						return state;
					}

					return {
						drafts: {
							...state.drafts,
							[draftKey]: payload,
						},
					};
				});
			},
			clearDraft: (shareId) => {
				set((state) => {
					const draftKey = getDraftKey(shareId);

					if (!(draftKey in state.drafts)) {
						return state;
					}

					const nextDrafts = { ...state.drafts };
					delete nextDrafts[draftKey];
					return {
						drafts: nextDrafts,
					};
				});
			},
		}),
		{
			name: "dbml-visualizer-drafts",
			storage: createJSONStorage(() => localStorage),
			partialize: (state) => ({
				drafts: state.drafts,
			}),
		},
	),
);
