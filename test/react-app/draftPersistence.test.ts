import { describe, expect, it } from "vitest";

import {
	buildDraftPayload,
	createDiagramRouteHref,
	getDiagramRouteState,
	getDraftHydrationResult,
	getInitialDraftState,
	resolveDraftPersistence,
} from "@/lib/draftPersistence";
import type { DiagramNode, SchemaPayload } from "@/types";

const SAMPLE_DBML = "Table users {\n  id integer [pk]\n}";

const createPayload = (
	source: string,
	positions: Record<string, { x: number; y: number }> = {},
): SchemaPayload => ({
	source,
	positions,
	version: 2,
});

describe("draftPersistence", () => {
	it("parses dirty shared routes and ignores dirty query params on the root route", () => {
		expect(getDiagramRouteState("/s/shared-123", "?dirty=true")).toEqual({
			shareId: "shared-123",
			isDirty: true,
		});
		expect(createDiagramRouteHref({ shareId: "shared-123", isDirty: true })).toBe(
			"/s/shared-123?dirty=true",
		);
		expect(getDiagramRouteState("/", "?dirty=true")).toEqual({
			shareId: null,
			isDirty: false,
		});
	});

	it("hydrates the root route from the local draft or the sample", () => {
		expect(
			getInitialDraftState({
					route: {
						shareId: null,
						isDirty: false,
					},
					draft: createPayload("Table drafts {}"),
					sampleSource: SAMPLE_DBML,
				}),
			).toEqual({
				source: "Table drafts {}",
				positions: {},
			});

		expect(
			getInitialDraftState({
					route: {
						shareId: null,
						isDirty: false,
					},
					draft: null,
					sampleSource: SAMPLE_DBML,
				}),
			).toEqual({
				source: SAMPLE_DBML,
				positions: {},
			});
	});

	it("ignores a local shared draft for a clean shared URL on initial load", () => {
		expect(
			getInitialDraftState({
					route: {
						shareId: "shared-123",
						isDirty: false,
					},
					draft: createPayload("Table stale_local_copy {}"),
					sampleSource: SAMPLE_DBML,
				}),
			).toEqual({
				source: "",
				positions: {},
			});
	});

	it("uses a local draft for a dirty shared route while revalidating remotely", () => {
		const localDraft = createPayload("Table bookings {}", {
			bookings: { x: 180, y: 220 },
		});

		expect(
			getDraftHydrationResult({
					route: {
						shareId: "shared-123",
						isDirty: true,
					},
					draft: localDraft,
					sampleSource: SAMPLE_DBML,
				}),
			).toEqual({
				source: localDraft.source,
				positions: localDraft.positions,
				currentShareId: "shared-123",
			remoteLoadMode: "background",
			canonicalRoute: {
				shareId: "shared-123",
				isDirty: true,
			},
			clearLocalDraftOnRemoteLoad: false,
		});
	});

	it("normalizes a dirty shared route without a draft back to the clean shared URL", () => {
		expect(
			getDraftHydrationResult({
					route: {
						shareId: "shared-123",
						isDirty: true,
					},
					draft: null,
					sampleSource: SAMPLE_DBML,
				}),
			).toEqual({
				source: "",
				positions: {},
				currentShareId: "shared-123",
			remoteLoadMode: "blocking",
			canonicalRoute: {
				shareId: "shared-123",
				isDirty: false,
			},
			clearLocalDraftOnRemoteLoad: false,
		});
	});

	it("loads the remote shared snapshot for a clean shared URL and marks stale local drafts as disposable", () => {
		expect(
			getDraftHydrationResult({
					route: {
						shareId: "shared-123",
						isDirty: false,
					},
					draft: createPayload("Table stale_local_copy {}"),
					sampleSource: SAMPLE_DBML,
				}),
			).toEqual({
				source: "",
				positions: {},
				currentShareId: "shared-123",
			remoteLoadMode: "blocking",
			canonicalRoute: {
				shareId: "shared-123",
				isDirty: false,
			},
			clearLocalDraftOnRemoteLoad: true,
		});
	});

	it("builds a draft payload from node positions when nodes are present", () => {
		const nodes = [
			{
				id: "users",
				position: { x: 80, y: 120 },
			},
			{
				id: "bookings",
				position: { x: 420, y: 120 },
			},
		] as DiagramNode[];

			expect(
				buildDraftPayload({
					source: "Table users {}",
					nodes,
					fallbackPositions: { ignored: { x: 1, y: 2 } },
				}),
		).toEqual(
			createPayload("Table users {}", {
				users: { x: 80, y: 120 },
				bookings: { x: 420, y: 120 },
			}),
		);
	});

	it("falls back to seeded positions when there are no visible nodes yet", () => {
			expect(
				buildDraftPayload({
					source: "Table users {}",
					nodes: [],
					fallbackPositions: { users: { x: 12, y: 24 } },
				}),
		).toEqual(
			createPayload("Table users {}", {
				users: { x: 12, y: 24 },
			}),
		);
	});

	it("keeps the root route clean only when it is still the untouched sample", () => {
		expect(
			resolveDraftPersistence({
					route: {
						shareId: null,
						isDirty: false,
					},
					payload: createPayload(SAMPLE_DBML, {}),
					sampleSource: SAMPLE_DBML,
					baseline: null,
				}),
		).toEqual({
			shouldStoreDraft: false,
			shouldClearDraft: true,
			nextRoute: {
				shareId: null,
				isDirty: false,
			},
		});

		expect(
			resolveDraftPersistence({
				route: {
					shareId: null,
					isDirty: false,
				},
					payload: createPayload("Table edited_root_copy {}", {
						users: { x: 12, y: 24 },
					}),
					sampleSource: SAMPLE_DBML,
					baseline: null,
				}),
		).toEqual({
			shouldStoreDraft: true,
			shouldClearDraft: false,
			nextRoute: {
				shareId: null,
				isDirty: false,
			},
		});
	});

	it("marks a clean shared route as dirty once it diverges from the remote baseline", () => {
		expect(
			resolveDraftPersistence({
					route: {
						shareId: "shared-123",
						isDirty: false,
					},
					payload: createPayload("Table edited_shared_copy {}"),
					sampleSource: SAMPLE_DBML,
					baseline: createPayload("Table original_shared_copy {}"),
				}),
		).toEqual({
			shouldStoreDraft: true,
			shouldClearDraft: false,
			nextRoute: {
				shareId: "shared-123",
				isDirty: true,
			},
		});
	});

	it("removes dirty state once a shared draft matches the original remote snapshot again", () => {
		const baseline = createPayload("Table original_shared_copy {}", {
			bookings: { x: 180, y: 220 },
		});

		expect(
			resolveDraftPersistence({
					route: {
						shareId: "shared-123",
						isDirty: true,
					},
					payload: baseline,
					sampleSource: SAMPLE_DBML,
					baseline,
				}),
		).toEqual({
			shouldStoreDraft: false,
			shouldClearDraft: true,
			nextRoute: {
				shareId: "shared-123",
				isDirty: false,
			},
		});
	});

	it("keeps a dirty shared draft untouched until the remote baseline is available", () => {
		expect(
			resolveDraftPersistence({
					route: {
						shareId: "shared-123",
						isDirty: true,
					},
					payload: createPayload("Table edited_shared_copy {}"),
					sampleSource: SAMPLE_DBML,
					baseline: null,
				}),
		).toEqual({
			shouldStoreDraft: true,
			shouldClearDraft: false,
			nextRoute: {
				shareId: "shared-123",
				isDirty: true,
			},
		});
	});
});
