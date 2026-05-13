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
	readonly source: string;
	readonly positions: DiagramPositions;
	readonly notes: readonly SharedStickyNote[];
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
	readonly baseline: { readonly shareId: string } | null;
	readonly updatedAt?: number;
}

export type ClientWorkspaceMessage =
	| { readonly type: "attach"; readonly state: WorkspaceSeed; readonly updatedAt: number }
	| { readonly type: "set-source"; readonly source: string }
	| { readonly type: "set-positions"; readonly positions: DiagramPositions }
	| { readonly type: "set-notes"; readonly notes: readonly SharedStickyNote[] }
	| { readonly type: "share-request" }
	| { readonly type: "ping" };

export type ServerWorkspaceMessage =
	| { readonly type: "state-ack"; readonly state: WorkspaceSnapshot }
	| { readonly type: "mcp-client-update"; readonly status: "connected"; readonly clientInfo: McpClientInfo }
	| { readonly type: "mcp-client-update"; readonly status: "disconnected"; readonly clientInfo: McpClientInfo }
	| { readonly type: "state-update"; readonly patch: Partial<WorkspaceSnapshot> }
	| { readonly type: "focus"; readonly tableIds: readonly string[] }
	| { readonly type: "share-result"; readonly id: string }
	| { readonly type: "share-error"; readonly error: string }
	| { readonly type: "error"; readonly message: string }
	| { readonly type: "pong" };
