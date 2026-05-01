import { createStore, type StoreApi } from "zustand/vanilla";

import { makeWorkspaceMcpUrl, makeWorkspaceWebSocketUrl } from "@/lib/workspace-url";
import { getOrCreateDeviceId } from "@/lib/device-workspace";
import { parseServerWorkspaceMessage } from "@/store/useWorkspaceStore";
import {
	emptyParsedSchema,
	type DiagramSessionStore,
} from "@/diagram-session/diagram-session-store";
import type { Diagram } from "@/diagram-session/diagram-session-context";
import type { CanvasRuntimeStore } from "@/canvas-next/canvas-runtime-store";
import type {
	ClientWorkspaceMessage,
	ServerWorkspaceMessage,
	WorkspaceSeed,
	WorkspaceSnapshot,
	WorkspaceStatus,
} from "@/types/workspace";

const DEFAULT_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_ATTEMPTS = 5;

export interface WorkspaceTransportHandlers {
	readonly onOpen: () => void;
	readonly onMessage: (message: ServerWorkspaceMessage) => void;
	readonly onClose: () => void;
	readonly onError: (message: string) => void;
}

export interface WorkspaceTransport {
	readonly send: (message: ClientWorkspaceMessage) => boolean;
	readonly close: (code?: number, reason?: string) => void;
}

export type WorkspaceTransportFactory = (
	workspaceId: string,
	handlers: WorkspaceTransportHandlers,
) => WorkspaceTransport;

export interface WorkspaceStoreAdapters {
	readonly createTransport?: WorkspaceTransportFactory;
	readonly getCurrentSeed: () => WorkspaceSeed;
	readonly hydrateSnapshot: (snapshot: WorkspaceSnapshot) => void;
	readonly applyPatch: (patch: Partial<WorkspaceSnapshot>) => void;
	readonly requestFocus: (tableIds: readonly string[]) => void;
	readonly handleShareResult: (shareId: string) => void;
	readonly createWorkspaceId?: () => string;
	readonly getLastUpdatedAt?: () => number;
	readonly setLastUpdatedAt?: (updatedAt: number) => void;
	readonly reconnectDelayMs?: number;
}

export interface WorkspaceState {
	readonly status: WorkspaceStatus;
	readonly workspaceId: string | null;
	readonly workspaceUrl: string | null;
	readonly reconnectAttempt: number;
	readonly lastError: string | null;
	readonly attach: () => void;
	readonly detach: () => void;
	readonly dispose: () => void;
}

export type WorkspaceStore = StoreApi<WorkspaceState>;

export const diagramFromWorkspaceSnapshot = (
	snapshot: WorkspaceSnapshot,
): Diagram => ({
	source: snapshot.source,
	parsedSchema: emptyParsedSchema,
	tablePositions: snapshot.positions,
	stickyNotes: snapshot.notes,
});

export function createWorkspaceWebSocketTransport(
	workspaceId: string,
	handlers: WorkspaceTransportHandlers,
): WorkspaceTransport {
	const socket = new WebSocket(makeWorkspaceWebSocketUrl(workspaceId));

	socket.addEventListener("open", handlers.onOpen);
	socket.addEventListener("message", (event) => {
		if (typeof event.data !== "string") return;
		const message = parseServerWorkspaceMessage(event.data);
		if (message) handlers.onMessage(message);
	});
	socket.addEventListener("close", handlers.onClose);
	socket.addEventListener("error", () =>
		handlers.onError("WebSocket connection failed."),
	);

	return {
		send: (message) => {
			if (socket.readyState !== WebSocket.OPEN) return false;
			socket.send(JSON.stringify(message));
			return true;
		},
		close: (code, reason) => {
			if (socket.readyState >= WebSocket.CLOSING) return;
			socket.close(code, reason);
		},
	};
}

export function createWorkspaceStore({
	createTransport = createWorkspaceWebSocketTransport,
	getCurrentSeed,
	hydrateSnapshot,
	applyPatch,
	requestFocus,
	handleShareResult,
	createWorkspaceId = getOrCreateDeviceId,
	getLastUpdatedAt = () => 0,
	setLastUpdatedAt,
	reconnectDelayMs = DEFAULT_RECONNECT_DELAY_MS,
}: WorkspaceStoreAdapters): WorkspaceStore {
	let activeTransport: WorkspaceTransport | null = null;
	let reconnectTimerId: number | null = null;
	let intentionalClose = false;
	let disposed = false;

	const clearReconnectTimer = () => {
		if (reconnectTimerId === null) return;
		window.clearTimeout(reconnectTimerId);
		reconnectTimerId = null;
	};

	const store = createStore<WorkspaceState>()((set, get) => {
		const connect = (workspaceId: string) => {
			const transport = createTransport(workspaceId, {
				onOpen: () => {
					if (disposed || activeTransport !== transport) return;
					transport.send({
						type: "attach",
						state: getCurrentSeed(),
						updatedAt: getLastUpdatedAt(),
					});
				},
				onMessage: (message) => {
					if (disposed || activeTransport !== transport) return;
					switch (message.type) {
						case "state-ack":
							clearReconnectTimer();
							if (typeof message.state.updatedAt === "number") {
								setLastUpdatedAt?.(message.state.updatedAt);
							}
							hydrateSnapshot(message.state);
							set({
								status: "live",
								workspaceUrl: makeWorkspaceMcpUrl(workspaceId),
								reconnectAttempt: 0,
								lastError: null,
							});
							return;
						case "focus":
							requestFocus(message.tableIds);
							return;
						case "state-update":
							if (typeof message.patch.updatedAt === "number") {
								setLastUpdatedAt?.(message.patch.updatedAt);
							}
							applyPatch(message.patch);
							return;
						case "share-result":
							handleShareResult(message.id);
							return;
						case "error":
							if (message.message === "workspace-expired") {
								intentionalClose = true;
								activeTransport?.close(1000, "Workspace expired");
								activeTransport = null;
								clearReconnectTimer();
								set({
									status: "ended",
									workspaceId: null,
									workspaceUrl: null,
									reconnectAttempt: 0,
									lastError: "workspace-expired",
								});
								return;
							}
							set({ lastError: message.message });
							return;
						case "share-error":
							set({ lastError: message.error });
							return;
						case "pong":
							return;
					}
				},
				onClose: () => {
					if (disposed || activeTransport !== transport) return;
					activeTransport = null;
					if (intentionalClose) return;

					const workspaceId = get().workspaceId;
					if (!workspaceId) return;
					const nextAttempt = get().reconnectAttempt + 1;
					if (nextAttempt > MAX_RECONNECT_ATTEMPTS) {
						set({
							status: "offline",
							workspaceId: null,
							workspaceUrl: null,
							lastError: "Workspace connection lost.",
							reconnectAttempt: 0,
						});
						return;
					}
					set({
						status: "reconnecting",
						workspaceUrl: null,
						reconnectAttempt: nextAttempt,
					});
					clearReconnectTimer();
					reconnectTimerId = window.setTimeout(() => {
						if (disposed || get().workspaceId !== workspaceId) return;
						connect(workspaceId);
					}, reconnectDelayMs);
				},
				onError: (message) => {
					if (disposed || activeTransport !== transport) return;
					set({ lastError: message });
				},
			});
			activeTransport = transport;
		};

		return {
			status: "offline",
			workspaceId: null,
			workspaceUrl: null,
			reconnectAttempt: 0,
			lastError: null,
			attach: () => {
				if (get().status !== "offline") return;
				disposed = false;
				intentionalClose = false;
				clearReconnectTimer();
				const workspaceId = createWorkspaceId();
				set({
					status: "connecting",
					workspaceId,
					workspaceUrl: null,
					reconnectAttempt: 0,
					lastError: null,
				});
				connect(workspaceId);
			},
			detach: () => {
				intentionalClose = true;
				clearReconnectTimer();
				activeTransport?.close(1000, "Workspace disconnected");
				activeTransport = null;
				set({
					status: "offline",
					workspaceId: null,
					workspaceUrl: null,
					reconnectAttempt: 0,
					lastError: null,
				});
			},
			dispose: () => {
				disposed = true;
				intentionalClose = true;
				clearReconnectTimer();
				activeTransport?.close(1000, "Workspace disconnected");
				activeTransport = null;
				set({
					status: "offline",
					workspaceId: null,
					workspaceUrl: null,
					reconnectAttempt: 0,
					lastError: null,
				});
			},
		};
	});

	return store;
}

export const createDiagramSessionWorkspaceHydrator =
	(diagramStore: DiagramSessionStore) => (snapshot: WorkspaceSnapshot) => {
		diagramStore.getState().hydrateDiagram(diagramFromWorkspaceSnapshot(snapshot));
	};

export const createDiagramSessionWorkspacePatchApplier =
	(diagramStore: DiagramSessionStore) =>
	(patch: Partial<WorkspaceSnapshot>) => {
		const state = diagramStore.getState();
		if (typeof patch.source === "string") {
			state.setSchemaSource(patch.source);
		}
		if (patch.positions) {
			state.commitTablePositions(patch.positions);
		}
		if (patch.notes) {
			state.replaceStickyNotes(patch.notes);
		}
	};

export const createCanvasRuntimeFocusRequester =
	(runtimeStore: CanvasRuntimeStore) => (tableIds: readonly string[]) => {
		runtimeStore.getState().requestFocus(tableIds);
	};
