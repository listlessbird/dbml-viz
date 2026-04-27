import { nanoid } from "nanoid";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";

import { pluralize, summary } from "@/lib/agent-activity-summary";
import { clearSessionPointer, writeSessionPointer } from "@/lib/session-pointer";
import { makeSessionMcpUrl, makeSessionWebSocketUrl } from "@/lib/session-url";
import { useAgentActivityStore } from "@/store/useAgentActivityStore";
import {
	parseServerSessionMessage,
	useSessionStore,
} from "@/store/useSessionStore";
import type { DiagramRouteState } from "@/lib/draftPersistence";
import type {
	ServerSessionMessage,
	SessionSeed,
	SessionSnapshot,
} from "@/types/session";

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

interface SessionConnectionOptions {
	readonly applySnapshot: (snapshot: SessionSnapshot) => void;
	readonly applyPatch: (patch: Partial<SessionSnapshot>) => void;
	readonly onFocusTables: (tableIds: readonly string[]) => void;
	readonly onShareResult: (id: string) => void;
	readonly onExpired: () => void;
}

export function useSessionConnection({
	applySnapshot,
	applyPatch,
	onFocusTables,
	onShareResult,
	onExpired,
}: SessionConnectionOptions) {
	const reconnectAttemptRef = useRef(0);
	const reconnectTimerRef = useRef<number | null>(null);
	const seedRef = useRef<SessionSeed | null>(null);
	const intentionalCloseRef = useRef(false);
	const reconnectingRef = useRef(false);
	const connectRef = useRef<(sessionId: string, mode: "init" | "reconnect") => void>(
		() => {},
	);
	const callbacksRef = useRef({
		applySnapshot,
		applyPatch,
		onFocusTables,
		onShareResult,
		onExpired,
	});

	useEffect(() => {
		callbacksRef.current = {
			applySnapshot,
			applyPatch,
			onFocusTables,
			onShareResult,
			onExpired,
		};
	}, [applyPatch, applySnapshot, onExpired, onFocusTables, onShareResult]);

	const clearReconnectTimer = useCallback(() => {
		if (reconnectTimerRef.current !== null) {
			window.clearTimeout(reconnectTimerRef.current);
			reconnectTimerRef.current = null;
		}
	}, []);

	const handleMessage = useCallback((message: ServerSessionMessage) => {
		const store = useSessionStore.getState();
		const activity = useAgentActivityStore.getState();

		switch (message.type) {
			case "state-ack":
				reconnectAttemptRef.current = 0;
				reconnectingRef.current = false;
				store.setLive();
				activity.setReconnect(null);
				activity.logActivity({
					direction: "out",
					tool: "session attached",
					parts: [summary.text("browser ready"), summary.code(message.state.tableCount + " tables")],
				});
				callbacksRef.current.applySnapshot(message.state);
				return;
			case "state-update":
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
				if (message.message === "session-expired") {
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

	const connect = useCallback((sessionId: string, mode: "init" | "reconnect") => {
		const socket = new WebSocket(makeSessionWebSocketUrl(sessionId));
		useSessionStore.getState().setSocket(socket);

		socket.addEventListener("open", () => {
			const store = useSessionStore.getState();
			if (mode === "init") {
				const seed = seedRef.current;
				if (!seed) {
					store.setError("Missing session seed.");
					socket.close();
					return;
				}
				store.send({ type: "init", state: seed });
				return;
			}
			store.send({ type: "reconnect" });
		});

		socket.addEventListener("message", (event) => {
			if (typeof event.data !== "string") return;
			const parsed = parseServerSessionMessage(event.data);
			if (parsed) handleMessage(parsed);
		});

		socket.addEventListener("close", () => {
			useSessionStore.getState().setSocket(null);
			if (intentionalCloseRef.current) return;
			const session = useSessionStore.getState();
			const activity = useAgentActivityStore.getState();
			if (!session.sessionId) return;

			const attempt = reconnectAttemptRef.current;
			if (attempt >= MAX_RECONNECT_ATTEMPTS) {
				clearSessionPointer(session.sessionId);
				session.setError("Session connection lost.");
				session.reset();
				activity.setReconnect(null);
				toast.error("Session connection lost. Local draft persistence resumed.");
				return;
			}

			reconnectingRef.current = true;
			session.setStatus("reconnecting");
			const delay = RECONNECT_DELAYS_MS[Math.min(attempt, RECONNECT_DELAYS_MS.length - 1)];
			reconnectAttemptRef.current = attempt + 1;
			activity.setReconnect({
				attempt: reconnectAttemptRef.current,
				nextDelayMs: delay,
				maxAttempts: MAX_RECONNECT_ATTEMPTS,
			});
			reconnectTimerRef.current = window.setTimeout(() => {
				connectRef.current(session.sessionId!, "reconnect");
			}, delay);
		});

		socket.addEventListener("error", () => {
			useSessionStore.getState().setError("WebSocket connection failed.");
		});
	}, [handleMessage]);
	useEffect(() => {
		connectRef.current = connect;
	}, [connect]);

	const startSession = useCallback((seed: SessionSeed, route: DiagramRouteState) => {
		const existing = useSessionStore.getState();
		if (existing.status !== "offline") return;

		const sessionId = nanoid(16);
		const pairingUrl = makeSessionMcpUrl(sessionId);
		seedRef.current = seed;
		intentionalCloseRef.current = false;
		reconnectAttemptRef.current = 0;
		clearReconnectTimer();
		writeSessionPointer({
			sessionId,
			routeShareId: route.shareId,
			routeIsDirty: route.isDirty,
			createdAt: Date.now(),
		});
		useAgentActivityStore.getState().reset();
		existing.setConnecting(sessionId, pairingUrl);
		connect(sessionId, "init");
	}, [clearReconnectTimer, connect]);

	const endSession = useCallback(() => {
		const { sessionId, socket } = useSessionStore.getState();
		intentionalCloseRef.current = true;
		clearReconnectTimer();
		if (sessionId) clearSessionPointer(sessionId);
		if (socket && socket.readyState < WebSocket.CLOSING) {
			socket.close(1000, "Session ended");
		}
		useSessionStore.getState().reset();
		useAgentActivityStore.getState().reset();
		seedRef.current = null;
	}, [clearReconnectTimer]);

	return {
		startSession,
		endSession,
	};
}
