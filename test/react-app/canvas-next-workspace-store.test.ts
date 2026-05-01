import { afterEach, describe, expect, it, vi } from "vitest";

import { createCanvasRuntimeStore } from "@/canvas-next/canvas-runtime-store";
import {
	createDiagramSessionStore,
	emptyDiagram,
} from "@/diagram-session/diagram-session-store";
import {
	createWorkspaceStore,
	diagramFromWorkspaceSnapshot,
	type WorkspaceTransport,
	type WorkspaceTransportHandlers,
} from "@/workspace/workspace-store";
import type {
	ClientWorkspaceMessage,
	ServerWorkspaceMessage,
	WorkspaceSeed,
	WorkspaceSnapshot,
} from "@/types/workspace";
import type { ParsedSchema } from "@/types";

const parsedSchema: ParsedSchema = {
	tables: [{ id: "stale_table", name: "stale_table", columns: [], indexes: [] }],
	refs: [
		{
			id: "stale_ref",
			from: { table: "stale_table", columns: ["id"] },
			to: { table: "other", columns: ["id"] },
			type: "one_to_many",
		},
	],
	errors: [],
};

const seed: WorkspaceSeed = {
	source: "Table local_table { id int }",
	positions: { local_table: { x: 1, y: 2 } },
	notes: [],
	baseline: null,
};

const snapshot: WorkspaceSnapshot = {
	source: "Table remote_table { id int }",
	positions: { remote_table: { x: 10, y: 20 } },
	notes: [
		{
			id: "remote-note",
			x: 30,
			y: 40,
			width: 160,
			height: 100,
			color: "green",
			text: "remote",
		},
	],
	diagnostics: [],
	tableCount: 1,
	refCount: 0,
	baseline: null,
	updatedAt: 123,
};

class FakeTransport implements WorkspaceTransport {
	readonly sent: ClientWorkspaceMessage[] = [];
	readonly closeCalls: Array<{ code?: number; reason?: string }> = [];

	constructor(readonly handlers: WorkspaceTransportHandlers) {}

	send(message: ClientWorkspaceMessage) {
		this.sent.push(message);
		return true;
	}

	close(code?: number, reason?: string) {
		this.closeCalls.push({ code, reason });
		this.handlers.onClose();
	}

	open() {
		this.handlers.onOpen();
	}

	serverMessage(message: ServerWorkspaceMessage) {
		this.handlers.onMessage(message);
	}

	serverClose() {
		this.handlers.onClose();
	}
}

const createHarness = () => {
	const transports: FakeTransport[] = [];
	const diagramStore = createDiagramSessionStore({
		source: "Table stale_table { id int }",
		parsedSchema,
		tablePositions: { stale_table: { x: 90, y: 91 } },
		stickyNotes: [
			{
				id: "stale-note",
				x: 1,
				y: 2,
				width: 100,
				height: 80,
				color: "yellow",
				text: "stale",
			},
		],
	});
	const runtimeStore = createCanvasRuntimeStore();
	const store = createWorkspaceStore({
		createTransport: (_workspaceId, handlers) => {
			const transport = new FakeTransport(handlers);
			transports.push(transport);
			return transport;
		},
		getCurrentSeed: () => seed,
		hydrateSnapshot: (nextSnapshot) => {
			diagramStore
				.getState()
				.hydrateDiagram(diagramFromWorkspaceSnapshot(nextSnapshot));
		},
		requestFocus: (tableIds) =>
			runtimeStore.getState().requestFocus(tableIds),
		createWorkspaceId: () => "workspace-1",
		getLastUpdatedAt: () => 77,
		reconnectDelayMs: 25,
	});
	return { store, diagramStore, runtimeStore, transports };
};

afterEach(() => {
	vi.useRealTimers();
});

describe("canvas-next Workspace Module Store", () => {
	it("attaches through the transport Adapter and hydrates a Workspace Snapshot atomically", () => {
		const { store, diagramStore, transports } = createHarness();

		store.getState().attach();
		expect(store.getState().status).toBe("connecting");
		expect(transports).toHaveLength(1);

		transports[0]!.open();
		expect(transports[0]!.sent).toEqual([
			{
				type: "attach",
				state: seed,
				updatedAt: 77,
			},
		]);

		transports[0]!.serverMessage({ type: "state-ack", state: snapshot });

		expect(store.getState().status).toBe("live");
		expect(store.getState().workspaceUrl).toContain(
			"/api/agent/workspace-1/mcp",
		);
		expect(diagramStore.getState().diagram).toEqual({
			source: snapshot.source,
			parsedSchema: emptyDiagram.parsedSchema,
			tablePositions: snapshot.positions,
			stickyNotes: snapshot.notes,
		});
	});

	it("routes remote Focus through Canvas Runtime without mutating durable Diagram state", () => {
		const { store, diagramStore, runtimeStore, transports } = createHarness();
		store.getState().attach();
		transports[0]!.open();
		transports[0]!.serverMessage({ type: "state-ack", state: snapshot });
		const beforeDiagram = diagramStore.getState().diagram;

		transports[0]!.serverMessage({
			type: "focus",
			tableIds: ["remote_table", "remote_table"],
		});

		expect(runtimeStore.getState().focusTableIds).toEqual(["remote_table"]);
		expect(diagramStore.getState().diagram).toBe(beforeDiagram);
	});

	it("scopes live transport state and ignores messages after dispose", () => {
		const { store, diagramStore, transports } = createHarness();
		store.getState().attach();
		transports[0]!.open();

		store.getState().dispose();

		expect(transports[0]!.closeCalls).toEqual([
			{ code: 1000, reason: "Workspace disconnected" },
		]);
		expect(store.getState().status).toBe("offline");

		transports[0]!.serverMessage({ type: "state-ack", state: snapshot });
		expect(diagramStore.getState().diagram.source).toBe(
			"Table stale_table { id int }",
		);
	});

	it("enters reconnecting on unexpected close and replaces stale projection state after reconnect", () => {
		vi.useFakeTimers();
		const { store, diagramStore, transports } = createHarness();
		store.getState().attach();
		transports[0]!.open();

		transports[0]!.serverClose();
		expect(store.getState().status).toBe("reconnecting");

		vi.advanceTimersByTime(25);
		expect(transports).toHaveLength(2);
		transports[1]!.open();
		transports[1]!.serverMessage({ type: "state-ack", state: snapshot });

		expect(store.getState().status).toBe("live");
		expect(diagramStore.getState().diagram.source).toBe(snapshot.source);
		expect(diagramStore.getState().diagram.stickyNotes).toEqual(snapshot.notes);
	});

	it("marks an expired Workspace ended without merging stale projection state", () => {
		const { store, diagramStore, transports } = createHarness();
		store.getState().attach();
		transports[0]!.open();

		transports[0]!.serverMessage({
			type: "error",
			message: "workspace-expired",
		});

		expect(store.getState().status).toBe("ended");
		expect(diagramStore.getState().diagram.source).toBe(
			"Table stale_table { id int }",
		);
	});
});
