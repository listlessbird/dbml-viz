import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import { pluralize, summary } from "@/lib/agent-activity-summary";
import { getOrCreateDeviceId } from "@/lib/device-workspace";
import { makeWorkspaceWebSocketUrl } from "@/lib/workspace-url";
import { useAgentActivityStore } from "@/store/useAgentActivityStore";
import { useWorkspaceMetaStore } from "@/store/useWorkspaceMetaStore";
import {
	parseServerWorkspaceMessage,
	useWorkspaceStore,
} from "@/store/useWorkspaceStore";
import type {
	ServerWorkspaceMessage,
	WorkspaceSeed,
	WorkspaceSnapshot,
} from "@/types/workspace";

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000] as const;

const formatPositionsSummary = (positions: Record<string, unknown> | undefined) => {
	if (!positions) return "0 nodes";
	return pluralize(Object.keys(positions).length, "node");
};

const truncateSnippet = (source: string, max = 32): string => {
	const firstLine = source.split("\n").find((line) => line.trim().length > 0) ?? "";
	const trimmed = firstLine.trim();
	return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
};

const recordServerUpdatedAt = (value: number) => {
	useWorkspaceMetaStore.getState().setLastServerUpdatedAt(value);
};

const readPersistedUpdatedAt = () =>
	useWorkspaceMetaStore.getState().lastServerUpdatedAt ?? 0;

interface WorkspaceConnectionOptions {
	readonly getCurrentSeed: () => WorkspaceSeed;
	readonly applySnapshot: (snapshot: WorkspaceSnapshot) => void;
	readonly applyPatch: (patch: Partial<WorkspaceSnapshot>) => void;
	readonly onFocusTables: (tableIds: readonly string[]) => void;
	readonly onShareResult: (id: string) => void;
	readonly onExpired: () => void;
}

export function useWorkspaceConnection({
	getCurrentSeed,
	applySnapshot,
	applyPatch,
	onFocusTables,
	onShareResult,
	onExpired,
}: WorkspaceConnectionOptions) {
	const reconnectAttemptRef = useRef(0);
	const reconnectTimerRef = useRef<number | null>(null);
	const seedRef = useRef<WorkspaceSeed | null>(null);
	const intentionalCloseRef = useRef(false);
	const reconnectingRef = useRef(false);
	const connectRef = useRef<(workspaceId: string) => void>(
		() => {},
	);
	const callbacksRef = useRef({
		getCurrentSeed,
		applySnapshot,
		applyPatch,
		onFocusTables,
		onShareResult,
		onExpired,
	});

	useEffect(() => {
		callbacksRef.current = {
			getCurrentSeed,
			applySnapshot,
			applyPatch,
			onFocusTables,
			onShareResult,
			onExpired,
		};
	}, [applyPatch, applySnapshot, getCurrentSeed, onExpired, onFocusTables, onShareResult]);

	const clearReconnectTimer = useCallback(() => {
		if (reconnectTimerRef.current !== null) {
			window.clearTimeout(reconnectTimerRef.current);
			reconnectTimerRef.current = null;
		}
	}, []);

	const handleMessage = useCallback((message: ServerWorkspaceMessage) => {
		const store = useWorkspaceStore.getState();
		const activity = useAgentActivityStore.getState();

		switch (message.type) {
			case "state-ack":
				reconnectAttemptRef.current = 0;
				reconnectingRef.current = false;
				if (typeof message.state.updatedAt === "number") {
					recordServerUpdatedAt(message.state.updatedAt);
				}
				store.setLive();
				activity.setReconnect(null);
				activity.logActivity({
					direction: "out",
					tool: "workspace attached",
					parts: [summary.text("browser ready"), summary.code(message.state.tableCount + " tables")],
				});
				callbacksRef.current.applySnapshot(message.state);
				return;
			case "state-update":
				if (typeof message.patch.updatedAt === "number") {
					recordServerUpdatedAt(message.patch.updatedAt);
				}
				if (typeof message.patch.source === "string") {
					store.lockEditorForAgent();
					activity.startAgentWriting({
						source: message.patch.source,
						tool: "set_schema",
						startedAt: Date.now(),
					});
					activity.logActivity({
						direction: "in",
						tool: "set_schema",
						parts: [summary.code(truncateSnippet(message.patch.source))],
					});
				}
				if (message.patch.positions) {
					activity.logActivity({
						direction: "in",
						tool: "set_positions",
						parts: [
							summary.text(formatPositionsSummary(message.patch.positions)),
						],
					});
				}
				if (message.patch.notes) {
					activity.logActivity({
						direction: "in",
						tool: "set_notes",
						parts: [summary.text(pluralize(message.patch.notes.length, "note"))],
					});
				}
				callbacksRef.current.applyPatch(message.patch);
				return;
			case "focus":
				activity.logActivity({
					direction: "in",
					tool: "focus_tables",
					parts: message.tableIds.slice(0, 3).map((id) => summary.code(id)),
				});
				callbacksRef.current.onFocusTables(message.tableIds);
				return;
			case "share-result":
				store.setSharing(false);
				activity.logActivity({
					direction: "out",
					tool: "snapshot saved",
					parts: [summary.code(`/s/${message.id}`)],
				});
				callbacksRef.current.onShareResult(message.id);
				return;
			case "share-error":
				store.setSharing(false);
				activity.logActivity({
					direction: "err",
					tool: "share_error",
					parts: [summary.text(message.error)],
				});
				toast.error(message.error);
				return;
			case "error":
				store.setError(message.message);
				if (message.message === "workspace-expired") {
					callbacksRef.current.onExpired();
				} else {
					activity.logActivity({
						direction: "err",
						tool: "error",
						parts: [summary.text(message.message)],
					});
					toast.error(message.message);
				}
				return;
			case "pong":
				return;
		}
	}, []);

	const connect = useCallback((workspaceId: string) => {
		const socket = new WebSocket(makeWorkspaceWebSocketUrl(workspaceId));
		useWorkspaceStore.getState().setSocket(socket);

		socket.addEventListener("open", () => {
			const store = useWorkspaceStore.getState();
			const seed = callbacksRef.current.getCurrentSeed();
			seedRef.current = seed;
			if (!seed) {
				store.setError("Missing workspace seed.");
				socket.close();
				return;
			}
			store.send({
				type: "attach",
				state: seed,
				updatedAt: readPersistedUpdatedAt(),
			});
		});

		socket.addEventListener("message", (event) => {
			if (typeof event.data !== "string") return;
			const parsed = parseServerWorkspaceMessage(event.data);
			if (parsed) handleMessage(parsed);
		});

		socket.addEventListener("close", () => {
			useWorkspaceStore.getState().setSocket(null);
			if (intentionalCloseRef.current) return;
			const workspace = useWorkspaceStore.getState();
			const activity = useAgentActivityStore.getState();
			if (!workspace.workspaceId) return;

			const attempt = reconnectAttemptRef.current;
			if (attempt >= MAX_RECONNECT_ATTEMPTS) {
				workspace.setError("Workspace connection lost.");
				workspace.reset();
				activity.setReconnect(null);
				toast.error("Workspace connection lost. Local draft persistence resumed.");
				return;
			}

			reconnectingRef.current = true;
			workspace.setStatus("reconnecting");
			const delay = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
			reconnectAttemptRef.current = attempt + 1;
			activity.setReconnect({
				attempt: reconnectAttemptRef.current,
				nextDelayMs: delay,
				maxAttempts: MAX_RECONNECT_ATTEMPTS,
			});
			reconnectTimerRef.current = window.setTimeout(() => {
				connectRef.current(workspace.workspaceId!);
			}, delay);
		});

		socket.addEventListener("error", () => {
			useWorkspaceStore.getState().setError("WebSocket connection failed.");
		});
	}, [handleMessage]);
	useEffect(() => {
		connectRef.current = connect;
	}, [connect]);

	const startWorkspace = useCallback((seed: WorkspaceSeed) => {
		const existing = useWorkspaceStore.getState();
		if (existing.status !== "offline") return;

		const workspaceId = getOrCreateDeviceId();
		seedRef.current = seed;
		intentionalCloseRef.current = false;
		reconnectAttemptRef.current = 0;
		clearReconnectTimer();
		useAgentActivityStore.getState().reset();
		existing.setConnecting(workspaceId);
		connect(workspaceId);
	}, [clearReconnectTimer, connect]);

	const endWorkspace = useCallback(() => {
		const { socket } = useWorkspaceStore.getState();
		intentionalCloseRef.current = true;
		clearReconnectTimer();
		if (socket && socket.readyState < WebSocket.CLOSING) {
			socket.close(1000, "Workspace disconnected");
		}
		useWorkspaceStore.getState().reset();
		useAgentActivityStore.getState().reset();
		seedRef.current = null;
	}, [clearReconnectTimer]);

	const markLocalWorkspaceChanged = useCallback(() => {
		recordServerUpdatedAt(Date.now());
	}, []);

	return {
		startWorkspace,
		endWorkspace,
		markLocalWorkspaceChanged,
	};
}
