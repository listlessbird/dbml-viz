export interface SharePosition {
	readonly x: number;
	readonly y: number;
}

export interface EditorPosition {
	readonly line: number;
	readonly column: number;
}

export interface ParseDiagnostic {
	readonly message: string;
	readonly code?: number;
	readonly location?: {
		readonly start: EditorPosition;
		readonly end?: EditorPosition;
	};
}

export interface SharedStickyNote {
	readonly id: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly color: "yellow" | "pink" | "blue" | "green";
	readonly text: string;
}

export type DiagramPositions = Record<string, SharePosition>;

export interface WorkspaceBaseline {
	readonly shareId: string;
	readonly source: string;
	readonly positions: DiagramPositions;
	readonly notes: readonly SharedStickyNote[];
}

export interface WorkspaceState {
	source: string;
	positions: DiagramPositions;
	notes: SharedStickyNote[];
	diagnostics: ParseDiagnostic[];
	parsedTableCount: number;
	parsedRefCount: number;
	baseline: WorkspaceBaseline | null;
	createdAt: number;
	updatedAt: number;
	lastActivityAt: number;
}

export interface WorkspaceSnapshot {
	readonly source: string;
	readonly positions: DiagramPositions;
	readonly notes: readonly SharedStickyNote[];
	readonly diagnostics: readonly ParseDiagnostic[];
	readonly tableCount: number;
	readonly refCount: number;
	readonly baseline: { readonly shareId: string } | null;
	readonly updatedAt: number;
}

export interface WorkspaceSeed {
	readonly source: string;
	readonly positions: DiagramPositions;
	readonly notes: readonly SharedStickyNote[];
	readonly baseline: WorkspaceBaseline | null;
}

export type ClientMessage =
	| { readonly type: "attach"; readonly state: WorkspaceSeed; readonly updatedAt: number }
	| { readonly type: "set-source"; readonly source: string }
	| { readonly type: "set-positions"; readonly positions: DiagramPositions }
	| { readonly type: "set-notes"; readonly notes: readonly SharedStickyNote[] }
	| {
			readonly type: "set-diagnostics";
			readonly diagnostics: readonly ParseDiagnostic[];
			readonly tableCount: number;
			readonly refCount: number;
	  }
	| { readonly type: "share-request" }
	| { readonly type: "ping" };

export type ServerMessage =
	| { readonly type: "state-ack"; readonly state: WorkspaceSnapshot }
	| { readonly type: "state-update"; readonly patch: Partial<WorkspaceSnapshot> }
	| { readonly type: "focus"; readonly tableIds: readonly string[] }
	| { readonly type: "share-result"; readonly id: string }
	| { readonly type: "share-error"; readonly error: string }
	| { readonly type: "error"; readonly message: string }
	| { readonly type: "pong" };

export const MAX_SCHEMA_SOURCE_LENGTH = 500_000;
export const WORKSPACE_EVICTION_MS = 30 * 24 * 60 * 60 * 1000;
export const SHARE_TTL_SECONDS = 60 * 60 * 24 * 90;
