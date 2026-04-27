import { nanoid } from "nanoid";
import { create } from "zustand";

import {
	AGENT_ACTIVITY_LOG_LIMIT,
	type AgentActivityDirection,
	type AgentActivityEntry,
	type AgentActivitySummaryPart,
	type AgentWritingState,
	type ReconnectState,
} from "@/types/session-activity";

interface AgentActivityState {
	readonly entries: readonly AgentActivityEntry[];
	readonly writing: AgentWritingState | null;
	readonly reconnect: ReconnectState | null;
	readonly logActivity: (input: {
		readonly direction: AgentActivityDirection;
		readonly tool: string;
		readonly parts: readonly AgentActivitySummaryPart[];
	}) => void;
	readonly clearEntries: () => void;
	readonly startAgentWriting: (state: AgentWritingState) => void;
	readonly endAgentWriting: () => void;
	readonly setReconnect: (state: ReconnectState | null) => void;
	readonly reset: () => void;
}

export const useAgentActivityStore = create<AgentActivityState>((set) => ({
	entries: [],
	writing: null,
	reconnect: null,
	logActivity: ({ direction, tool, parts }) =>
		set((state) => ({
			entries: [
				{
					id: nanoid(8),
					timestamp: Date.now(),
					direction,
					tool,
					parts,
				},
				...state.entries,
			].slice(0, AGENT_ACTIVITY_LOG_LIMIT),
		})),
	clearEntries: () => set({ entries: [] }),
	startAgentWriting: (writing) => set({ writing }),
	endAgentWriting: () => set({ writing: null }),
	setReconnect: (reconnect) => set({ reconnect }),
	reset: () => set({ entries: [], writing: null, reconnect: null }),
}));

export const logAgentActivity = (input: {
	readonly direction: AgentActivityDirection;
	readonly tool: string;
	readonly parts: readonly AgentActivitySummaryPart[];
}) => useAgentActivityStore.getState().logActivity(input);
