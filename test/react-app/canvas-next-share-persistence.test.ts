import { describe, expect, it, vi } from "vitest";

import {
	applyWorkspaceShareResult,
	loadShareIntoDiagramSession,
	saveDiagramSessionShare,
	resolveShareRouteDecision,
} from "@/canvas-next/diagram-persistence";
import {
	createDiagramSessionStore,
	emptyDiagram,
} from "@/diagram-session/diagram-session-store";
import type { DiagramPersistenceAdapter } from "@/canvas-next/diagram-persistence-adapter";
import type { SchemaPayload } from "@/types";

const payload = (source: string): SchemaPayload => ({
	source,
	positions: { users: { x: 10, y: 20 } },
	notes: [
		{
			id: "note-1",
			x: 30,
			y: 40,
			width: 160,
			height: 120,
			color: "yellow",
			text: "See [[users]]",
		},
	],
	version: 3,
});

function createAdapter(overrides: Partial<DiagramPersistenceAdapter> = {}) {
	return {
		getDraft: vi.fn(() => null),
		setDraft: vi.fn(),
		clearDraft: vi.fn(),
		loadShare: vi.fn(async () => payload("Table remote_users { id int }")),
		saveShare: vi.fn(async () => ({ id: "share-new" })),
		...overrides,
	} satisfies DiagramPersistenceAdapter;
}

describe("canvas-next Share persistence", () => {
	it("saves a Share from Diagram Session Schema Payload state", async () => {
		const store = createDiagramSessionStore({
			...emptyDiagram,
			source: "Table local_users { id int }",
			tablePositions: { local_users: { x: 5, y: 8 } },
			stickyNotes: [
				{
					id: "note-local",
					x: 1,
					y: 2,
					width: 120,
					height: 90,
					color: "blue",
					text: "local",
				},
			],
		});
		const adapter = createAdapter();

		const result = await saveDiagramSessionShare({
			adapter,
			sessionStore: store,
		});

		expect(adapter.saveShare).toHaveBeenCalledWith({
			source: "Table local_users { id int }",
			positions: { local_users: { x: 5, y: 8 } },
			notes: [
				{
					id: "note-local",
					x: 1,
					y: 2,
					width: 120,
					height: 90,
					color: "blue",
					text: "local",
				},
			],
			version: 3,
		});
		expect(result).toEqual({
			shareId: "share-new",
			payload: store.getState().toSchemaPayload(),
		});
	});

	it("loads and validates a Share before hydrating durable Diagram state", async () => {
		const store = createDiagramSessionStore({
			...emptyDiagram,
			source: "Table stale_local { id int }",
			tablePositions: { stale_local: { x: 100, y: 200 } },
			stickyNotes: [
				{
					id: "stale-note",
					x: 1,
					y: 2,
					width: 100,
					height: 80,
					color: "pink",
					text: "stale",
				},
			],
		});
		const remotePayload = payload("Table remote_users { id int }");
		const adapter = createAdapter({
			loadShare: vi.fn(async () => remotePayload),
		});

		const loaded = await loadShareIntoDiagramSession({
			adapter,
			sessionStore: store,
			shareId: "share-1",
		});

		expect(loaded).toEqual(remotePayload);
		expect(store.getState().diagram).toEqual({
			source: remotePayload.source,
			parsedSchema: emptyDiagram.parsedSchema,
			tablePositions: remotePayload.positions,
			stickyNotes: remotePayload.notes,
		});
	});

	it("rejects invalid remote Share payloads without replacing durable state", async () => {
		const store = createDiagramSessionStore({
			...emptyDiagram,
			source: "Table keep_me { id int }",
		});
		const adapter = createAdapter({
			loadShare: vi.fn(async () => ({
				source: "Table invalid { id int }",
				positions: {},
				notes: [],
				version: 2,
			})),
		});

		await expect(
			loadShareIntoDiagramSession({
				adapter,
				sessionStore: store,
				shareId: "bad-share",
			}),
		).rejects.toThrow("Shared schema payload is invalid.");
		expect(store.getState().diagram.source).toBe("Table keep_me { id int }");
	});

	it("derives shared route dirty state from the Share Baseline", () => {
		const baseline = payload("Table shared { id int }");

		expect(
			resolveShareRouteDecision({
				route: { shareId: "share-1", isDirty: false },
				payload: payload("Table edited { id int }"),
				baseline,
			}).nextRoute,
		).toEqual({ shareId: "share-1", isDirty: true });

		expect(
			resolveShareRouteDecision({
				route: { shareId: "share-1", isDirty: true },
				payload: baseline,
				baseline,
			}).nextRoute,
		).toEqual({ shareId: "share-1", isDirty: false });
	});

	it("applies Workspace Share results through Diagram Persistence policy", () => {
		const store = createDiagramSessionStore({
			...emptyDiagram,
			source: "Table workspace_users { id int }",
			tablePositions: { workspace_users: { x: 7, y: 9 } },
			stickyNotes: [
				{
					id: "workspace-note",
					x: 3,
					y: 4,
					width: 120,
					height: 90,
					color: "green",
					text: "workspace",
				},
			],
		});
		const adapter = createAdapter();
		const setShareBaseline = vi.fn();
		const pushViewedRoute = vi.fn();

		const baseline = applyWorkspaceShareResult({
			adapter,
			sessionStore: store,
			shareId: "share-next",
			currentShareId: "share-current",
			setShareBaseline,
			pushViewedRoute,
		});

		expect(adapter.clearDraft).toHaveBeenCalledWith("share-current");
		expect(adapter.clearDraft).toHaveBeenCalledWith("share-next");
		expect(baseline).toEqual({
			shareId: "share-next",
			payload: store.getState().toSchemaPayload(),
		});
		expect(setShareBaseline).toHaveBeenCalledWith(baseline);
		expect(pushViewedRoute).toHaveBeenCalledWith({
			shareId: "share-next",
			isDirty: false,
		});
	});
});
