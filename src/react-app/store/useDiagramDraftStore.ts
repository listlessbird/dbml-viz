import { create } from "zustand";
import {
	createJSONStorage,
	persist,
	type StateStorage,
} from "zustand/middleware";

import { areSchemaPayloadsEqual } from "@/lib/draftPersistence";
import { parseSchemaPayload } from "@/lib/schema-payload";
import type { SchemaPayload } from "@/types";

const LOCAL_DRAFT_STORAGE_PREFIX = "dbml-viz:local-draft:";
const ROOT_DRAFT_KEY = `${LOCAL_DRAFT_STORAGE_PREFIX}root`;
const MAX_DRAFTS = 20;

const getDraftKey = (shareId: string | null) =>
	`${LOCAL_DRAFT_STORAGE_PREFIX}${shareId ?? "root"}`;

interface DraftEnvelope {
	readonly payload: SchemaPayload;
	readonly savedAt: number;
}

// Tolerant read: entries are either envelopes or legacy raw payloads
// (written before savedAt existed). Legacy entries are not rewritten on
// read; they gain the envelope on their next save.
const readDraftPayload = (entry: unknown): SchemaPayload | null => {
	const legacy = parseSchemaPayload(entry);
	if (legacy) return legacy;
	if (typeof entry !== "object" || entry === null) return null;
	return parseSchemaPayload((entry as { payload?: unknown }).payload);
};

// Legacy entries without savedAt count as oldest (age 0).
const readSavedAt = (entry: unknown): number => {
	if (typeof entry !== "object" || entry === null) return 0;
	const savedAt = (entry as { savedAt?: unknown }).savedAt;
	return typeof savedAt === "number" ? savedAt : 0;
};

// Drops the oldest drafts by savedAt until at most keepCount remain. The
// root draft (the user's primary unsaved work) and protectedKey (the draft
// being written) are never dropped. Stable sort keeps insertion order for
// equal savedAt, so ties drop oldest-inserted first.
const pruneDraftRecord = (
	drafts: Record<string, unknown>,
	keepCount: number,
	protectedKey?: string,
): Record<string, unknown> => {
	const keys = Object.keys(drafts);
	const dropCount = Math.min(
		keys.length - keepCount,
		keys.filter((key) => key !== ROOT_DRAFT_KEY && key !== protectedKey).length,
	);
	if (dropCount <= 0) return drafts;
	const droppable = keys
		.filter((key) => key !== ROOT_DRAFT_KEY && key !== protectedKey)
		.sort((a, b) => readSavedAt(drafts[a]) - readSavedAt(drafts[b]));
	const next = { ...drafts };
	for (const key of droppable.slice(0, dropCount)) {
		delete next[key];
	}
	return next;
};

interface PersistedDraftState {
	readonly drafts: Record<string, unknown>;
}

// Recovery for a quota-failed write: parse the JSON the persist middleware
// produced, drop the oldest half of the drafts, and re-stringify. Throws
// only via JSON.parse on malformed input; the caller catches.
const pruneSerializedDrafts = (
	value: string,
): { readonly pruned: string; readonly keepCount: number } => {
	const parsed = JSON.parse(value) as {
		state?: { drafts?: Record<string, unknown> };
	};
	const drafts = parsed.state?.drafts;
	if (!drafts || typeof drafts !== "object") {
		return { pruned: value, keepCount: 0 };
	}
	const keepCount = Math.max(1, Math.floor(Object.keys(drafts).length / 2));
	parsed.state = { ...parsed.state, drafts: pruneDraftRecord(drafts, keepCount) };
	return { pruned: JSON.stringify(parsed), keepCount };
};

// localStorage access throws in Safari private mode; setItem throws on
// quota. Persistence failure must never crash the app.
const quotaSafeLocalStorage: StateStorage = {
	getItem: (name) => {
		try {
			return localStorage.getItem(name);
		} catch {
			return null;
		}
	},
	setItem: (name, value) => {
		try {
			localStorage.setItem(name, value);
			return;
		} catch {
			console.warn(
				"draft storage full, pruning oldest drafts and retrying save",
			);
		}
		try {
			const { pruned, keepCount } = pruneSerializedDrafts(value);
			localStorage.setItem(name, pruned);
			// converge the in-memory record with what storage now holds
			if (keepCount > 0) {
				useDiagramDraftStore.getState().pruneDrafts(keepCount);
			}
		} catch {
			console.warn("draft storage full, drafts are not being saved");
		}
	},
	removeItem: (name) => {
		try {
			localStorage.removeItem(name);
		} catch {
			// ignore: nothing to recover when removal fails
		}
	},
};

interface DiagramDraftState {
	readonly drafts: Record<string, unknown>;
	readonly getDraft: (shareId: string | null) => SchemaPayload | null;
	readonly setDraft: (shareId: string | null, payload: SchemaPayload) => void;
	readonly clearDraft: (shareId: string | null) => void;
	/** Internal: quota recovery and tests only. */
	readonly pruneDrafts: (keepCount: number) => void;
}

export const useDiagramDraftStore = create<DiagramDraftState>()(
	persist(
		(set, get) => ({
			drafts: {},
			getDraft: (shareId) => readDraftPayload(get().drafts[getDraftKey(shareId)]),
			setDraft: (shareId, payload) => {
				set((state) => {
					const draftKey = getDraftKey(shareId);
					const currentDraft = readDraftPayload(state.drafts[draftKey]);

					if (currentDraft && areSchemaPayloadsEqual(currentDraft, payload)) {
						return state;
					}

					const envelope: DraftEnvelope = { payload, savedAt: Date.now() };
					return {
						drafts: pruneDraftRecord(
							{
								...state.drafts,
								[draftKey]: envelope,
							},
							MAX_DRAFTS,
							draftKey,
						),
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
			pruneDrafts: (keepCount) => {
				set((state) => ({
					drafts: pruneDraftRecord(state.drafts, keepCount),
				}));
			},
		}),
		{
			name: "dbml-visualizer-drafts",
			version: 1,
			storage: createJSONStorage(() => quotaSafeLocalStorage),
			partialize: (state) => ({
				drafts: state.drafts,
			}),
			// tolerant getDraft handles both legacy and envelope shapes; the
			// version bump exists so a future migration has a baseline
			migrate: (persistedState) => persistedState as PersistedDraftState,
		},
	),
);
