import { describe, expect, it } from "vitest";

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
