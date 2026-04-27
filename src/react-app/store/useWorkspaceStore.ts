import { create } from "zustand";

import { makeWorkspaceMcpUrl } from "@/lib/workspace-url";
import type {
	ClientWorkspaceMessage,
	ServerWorkspaceMessage,
	WorkspaceStatus,
} from "@/types/workspace";

interface WorkspaceRuntimeState {
	readonly status: WorkspaceStatus;
	readonly workspaceId: string | null;
	readonly workspaceUrl: string | null;
	readonly socket: WebSocket | null;
	readonly agentEditorLocked: boolean;
	readonly isSharing: boolean;
	readonly lastError: string | null;
	readonly setConnecting: (workspaceId: string) => void;
	readonly setSocket: (socket: WebSocket | null) => void;
	readonly setStatus: (status: WorkspaceStatus) => void;
	readonly setLive: () => void;
	readonly setError: (message: string | null) => void;
	readonly lockEditorForAgent: () => void;
	readonly unlockEditor: () => void;
	readonly setSharing: (isSharing: boolean) => void;
	readonly reset: () => void;
	readonly send: (message: ClientWorkspaceMessage) => boolean;
}

const canSend = (socket: WebSocket | null): socket is WebSocket =>
	socket !== null && socket.readyState === WebSocket.OPEN;

export const useWorkspaceStore = create<WorkspaceRuntimeState>((set, get) => ({
	status: "offline",
	workspaceId: null,
	workspaceUrl: null,
	socket: null,
	agentEditorLocked: false,
	isSharing: false,
	lastError: null,
	setConnecting: (workspaceId) => {
		set({
			status: "connecting",
			workspaceId,
			workspaceUrl: null,
			lastError: null,
			agentEditorLocked: false,
		});
	},
	setSocket: (socket) => set({ socket }),
	setStatus: (status) => set({ status }),
	setLive: () => {
		const workspaceId = get().workspaceId;
		set({
			status: "live",
			workspaceUrl: workspaceId ? makeWorkspaceMcpUrl(workspaceId) : null,
			lastError: null,
		});
	},
	setError: (message) => set({ lastError: message }),
	lockEditorForAgent: () => set({ agentEditorLocked: true }),
	unlockEditor: () => set({ agentEditorLocked: false }),
	setSharing: (isSharing) => set({ isSharing }),
	reset: () => {
		const socket = get().socket;
		if (socket && socket.readyState < WebSocket.CLOSING) {
			socket.close(1000, "Workspace disconnected");
		}
		set({
			status: "offline",
			workspaceId: null,
			workspaceUrl: null,
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

export const parseServerWorkspaceMessage = (
	raw: string,
): ServerWorkspaceMessage | null => {
	try {
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object" && "type" in parsed
			? (parsed as ServerWorkspaceMessage)
			: null;
	} catch {
		return null;
	}
};
