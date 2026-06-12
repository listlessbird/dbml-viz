import { describe, expect, it, vi } from "vitest";

import {
	getDraftHydrationResult,
	getInitialDraftState,
} from "@/lib/draftPersistence";
import { useDiagramDraftStore } from "@/store/useDiagramDraftStore";
import type { SchemaPayload } from "@/types";

const SAMPLE_DBML = "Table users {\n  id integer [pk]\n}";

const createPayload = (
	source: string,
	positions: Record<string, { x: number; y: number }> = {},
): SchemaPayload => ({
	source,
	positions,
	notes: [],
	version: 3,
});

describe("useDiagramDraftStore", () => {
	it("stores separate drafts for root and shared routes", () => {
		const rootDraft = createPayload("Table users {}", {
			users: { x: 40, y: 60 },
		});
		const sharedDraft = createPayload("Table bookings {}", {
			bookings: { x: 140, y: 260 },
		});

		useDiagramDraftStore.getState().setDraft(null, rootDraft);
		useDiagramDraftStore.getState().setDraft("shared-123", sharedDraft);

		expect(useDiagramDraftStore.getState().getDraft(null)).toEqual(rootDraft);
		expect(useDiagramDraftStore.getState().getDraft("shared-123")).toEqual(sharedDraft);
	});

	it("loads whichever draft matches the current route and never cross-contaminates root and shared work", () => {
		const rootDraft = createPayload("Table root_workspace {}", {
			root_workspace: { x: 20, y: 40 },
		});
		const sharedDraft = createPayload("Table share_workspace {}", {
			share_workspace: { x: 220, y: 140 },
		});

		useDiagramDraftStore.getState().setDraft(null, rootDraft);
		useDiagramDraftStore.getState().setDraft("shared-123", sharedDraft);

		expect(
			getInitialDraftState({
					route: {
						shareId: null,
						isDirty: false,
					},
					draft: useDiagramDraftStore.getState().getDraft(null),
					sampleSource: SAMPLE_DBML,
				}),
			).toEqual({
				source: rootDraft.source,
				positions: rootDraft.positions,
				notes: [],
			});

		expect(
			getDraftHydrationResult({
					route: {
						shareId: "shared-123",
						isDirty: true,
					},
					draft: useDiagramDraftStore.getState().getDraft("shared-123"),
					sampleSource: SAMPLE_DBML,
				}),
			).toMatchObject({
				source: sharedDraft.source,
				positions: sharedDraft.positions,
				remoteLoadMode: "background",
			});
	});

	it("clears one route draft without touching others", () => {
		const rootDraft = createPayload("Table users {}");
		const sharedDraft = createPayload("Table reviews {}");

		useDiagramDraftStore.getState().setDraft(null, rootDraft);
		useDiagramDraftStore.getState().setDraft("shared-123", sharedDraft);
		useDiagramDraftStore.getState().clearDraft(null);

		expect(useDiagramDraftStore.getState().getDraft(null)).toBeNull();
		expect(useDiagramDraftStore.getState().getDraft("shared-123")).toEqual(sharedDraft);
	});

	it("ignores invalid persisted draft payloads when reading state", () => {
		useDiagramDraftStore.setState({
			drafts: {
				"dbml-viz:local-draft:root": {
					dbml: "Table legacy_users {}",
					positions: {},
					version: 1,
				},
			},
		});

		expect(useDiagramDraftStore.getState().getDraft(null)).toBeNull();
	});

	it("persists drafts through Zustand persist storage", () => {
		const draft = createPayload("Table cities {}", {
			cities: { x: 100, y: 120 },
		});

		useDiagramDraftStore.getState().setDraft("shared-456", draft);

		const persisted = window.localStorage.getItem("dbml-visualizer-drafts");

		expect(persisted).toContain("dbml-viz:local-draft:shared-456");
		expect(persisted).toContain("Table cities");
	});
});

describe("useDiagramDraftStore bounded storage", () => {
	it("round-trips a draft through the savedAt envelope", () => {
		useDiagramDraftStore.setState({ drafts: {} });
		const draft = createPayload("Table envelopes {}", {
			envelopes: { x: 10, y: 20 },
		});

		useDiagramDraftStore.getState().setDraft("envelope-share", draft);

		expect(useDiagramDraftStore.getState().getDraft("envelope-share")).toEqual(
			draft,
		);
	});

	it("still reads legacy drafts stored as raw payloads without an envelope", () => {
		const legacyPayload = createPayload("Table legacy {}", {
			legacy: { x: 1, y: 2 },
		});
		useDiagramDraftStore.setState({
			drafts: {
				"dbml-viz:local-draft:legacy-share": legacyPayload,
			},
		});

		expect(useDiagramDraftStore.getState().getDraft("legacy-share")).toEqual(
			legacyPayload,
		);
	});

	it("drops the oldest non-root drafts once the record exceeds the cap", () => {
		useDiagramDraftStore.setState({ drafts: {} });
		useDiagramDraftStore.getState().setDraft(null, createPayload("Table root {}"));
		for (let index = 1; index <= 21; index++) {
			useDiagramDraftStore
				.getState()
				.setDraft(`share-${index}`, createPayload(`Table t${index} {}`));
		}

		const state = useDiagramDraftStore.getState();
		expect(Object.keys(state.drafts)).toHaveLength(20);
		expect(state.getDraft(null)).not.toBeNull();
		expect(state.getDraft("share-1")).toBeNull();
		expect(state.getDraft("share-2")).toBeNull();
		expect(state.getDraft("share-3")).not.toBeNull();
		expect(state.getDraft("share-21")).not.toBeNull();
	});

	it("does not rewrite the record when the payload is unchanged", () => {
		useDiagramDraftStore.setState({ drafts: {} });
		const draft = createPayload("Table unchanged {}");

		useDiagramDraftStore.getState().setDraft("noop-share", draft);
		const recordAfterFirstWrite = useDiagramDraftStore.getState().drafts;
		useDiagramDraftStore.getState().setDraft("noop-share", { ...draft });

		expect(useDiagramDraftStore.getState().drafts).toBe(recordAfterFirstWrite);
	});

	it("recovers from a storage quota error by pruning and retrying without losing the new draft", () => {
		useDiagramDraftStore.setState({ drafts: {} });
		for (let index = 1; index <= 10; index++) {
			useDiagramDraftStore
				.getState()
				.setDraft(`share-${index}`, createPayload(`Table t${index} {}`));
		}

		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const originalSetItem = Storage.prototype.setItem;
		let hasThrown = false;
		const setItemSpy = vi
			.spyOn(Storage.prototype, "setItem")
			.mockImplementation(function (this: Storage, key: string, value: string) {
				if (!hasThrown) {
					hasThrown = true;
					throw new DOMException("quota exceeded", "QuotaExceededError");
				}
				originalSetItem.call(this, key, value);
			});

		try {
			const freshDraft = createPayload("Table fresh {}");
			expect(() =>
				useDiagramDraftStore.getState().setDraft("share-fresh", freshDraft),
			).not.toThrow();

			expect(useDiagramDraftStore.getState().getDraft("share-fresh")).toEqual(
				freshDraft,
			);
			expect(warnSpy).toHaveBeenCalled();
			expect(
				Object.keys(useDiagramDraftStore.getState().drafts).length,
			).toBeLessThan(11);
		} finally {
			setItemSpy.mockRestore();
			warnSpy.mockRestore();
		}
	});
});
