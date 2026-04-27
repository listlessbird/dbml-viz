export type AgentActivityDirection = "in" | "out" | "err";

export type AgentActivitySummaryPart =
	| { readonly kind: "text"; readonly value: string }
	| { readonly kind: "code"; readonly value: string }
	| { readonly kind: "strong"; readonly value: string };

export interface AgentActivityEntry {
	readonly id: string;
	readonly timestamp: number;
	readonly direction: AgentActivityDirection;
	readonly tool: string;
	readonly parts: readonly AgentActivitySummaryPart[];
}

export interface AgentWritingState {
	readonly source: string;
	readonly tool: string;
	readonly startedAt: number;
}

export interface ReconnectState {
	readonly attempt: number;
	readonly nextDelayMs: number;
	readonly maxAttempts: number;
}

export const AGENT_ACTIVITY_LOG_LIMIT = 60;

export const isInboundDirection = (direction: AgentActivityDirection): boolean =>
	direction === "in";
