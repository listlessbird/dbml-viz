import type { DiagramPositions, SharedStickyNote } from "@/types";

export type WorkspaceStatus =
	| "offline"
	| "connecting"
	| "live"
	| "reconnecting"
	| "ended";

export interface McpClientInfo {
	readonly name: string;
	readonly title?: string;
	readonly version?: string;
}

export type McpClientPresence =
	| { readonly status: "waiting"; readonly clientInfo: null }
	| { readonly status: "connected"; readonly clientInfo: McpClientInfo }
	| { readonly status: "disconnected"; readonly clientInfo: McpClientInfo };

interface WorkspaceBaseline {
	readonly shareId: string;
}

export interface WorkspaceSeed {
	readonly source: string;
	readonly positions: DiagramPositions;
	readonly notes: readonly SharedStickyNote[];
	readonly baseline: WorkspaceBaseline | null;
}

export interface WorkspaceSnapshot {
	readonly source: string;
	readonly positions: DiagramPositions;
	readonly notes: readonly SharedStickyNote[];
	readonly baseline: WorkspaceBaseline | null;
	readonly updatedAt: number;
}

export type ClientWorkspaceMessage =
	| { readonly type: "attach"; readonly state: WorkspaceSeed; readonly updatedAt: number }
	| { readonly type: "end-workspace" }
	| { readonly type: "ping" };

export type ServerWorkspaceMessage =
	| { readonly type: "cf_agent_state"; readonly state: WorkspaceSnapshot | null }
	| { readonly type: "mcp-client-update"; readonly status: "connected"; readonly clientInfo: McpClientInfo }
	| { readonly type: "mcp-client-update"; readonly status: "disconnected"; readonly clientInfo: McpClientInfo }
	| { readonly type: "focus"; readonly tableIds: readonly string[] }
	| { readonly type: "workspace-ended" }
	| { readonly type: "error"; readonly message: string }
	| { readonly type: "pong" };
