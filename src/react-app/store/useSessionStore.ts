import { create } from "zustand";

import type {
	ClientSessionMessage,
	ServerSessionMessage,
	SessionSeed,
	SessionStatus,
} from "@/types/session";

interface SessionRuntimeState {
	readonly status: SessionStatus;
	readonly sessionId: string | null;
	readonly pairingUrl: string | null;
	readonly socket: WebSocket | null;
	readonly agentEditorLocked: boolean;
	readonly isSharing: boolean;
	readonly lastError: string | null;
	readonly setConnecting: (sessionId: string, pairingUrl: string) => void;
	readonly setSocket: (socket: WebSocket | null) => void;
	readonly setStatus: (status: SessionStatus) => void;
	readonly setLive: () => void;
	readonly setError: (message: string | null) => void;
	readonly lockEditorForAgent: () => void;
	readonly unlockEditor: () => void;
	readonly setSharing: (isSharing: boolean) => void;
	readonly reset: () => void;
	readonly send: (message: ClientSessionMessage) => boolean;
}

const canSend = (socket: WebSocket | null): socket is WebSocket =>
	socket !== null && socket.readyState === WebSocket.OPEN;

export const useSessionStore = create<SessionRuntimeState>((set, get) => ({
	status: "offline",
	sessionId: null,
	pairingUrl: null,
	socket: null,
	agentEditorLocked: false,
	isSharing: false,
	lastError: null,
	setConnecting: (sessionId, pairingUrl) => {
		set({
			status: "connecting",
			sessionId,
			pairingUrl,
			lastError: null,
			agentEditorLocked: false,
		});
	},
	setSocket: (socket) => set({ socket }),
	setStatus: (status) => set({ status }),
	setLive: () => set({ status: "live", lastError: null }),
	setError: (message) => set({ lastError: message }),
	lockEditorForAgent: () => set({ agentEditorLocked: true }),
	unlockEditor: () => set({ agentEditorLocked: false }),
	setSharing: (isSharing) => set({ isSharing }),
	reset: () => {
		const socket = get().socket;
		if (socket && socket.readyState < WebSocket.CLOSING) {
			socket.close(1000, "Session ended");
		}
		set({
			status: "offline",
			sessionId: null,
			pairingUrl: null,
			socket: null,
			agentEditorLocked: false,
			isSharing: false,
			lastError: null,
		});
	},
	send: (message) => {
		const socket = get().socket;
		if (!canSend(socket)) return false;
		socket.send(JSON.stringify(message));
		return true;
	},
}));

export const parseServerSessionMessage = (
	raw: string,
): ServerSessionMessage | null => {
	try {
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object" && "type" in parsed
			? (parsed as ServerSessionMessage)
			: null;
	} catch {
		return null;
	}
};

export const sendSessionInit = (seed: SessionSeed): boolean =>
	useSessionStore.getState().send({ type: "init", state: seed });
