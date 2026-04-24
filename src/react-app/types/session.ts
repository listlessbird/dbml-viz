import type { DiagramPositions, ParseDiagnostic, SharedStickyNote } from "@/types";

export type SessionStatus =
	| "offline"
	| "connecting"
	| "live"
	| "reconnecting"
	| "ended";

export interface SessionBaseline {
	readonly shareId: string;
	readonly source: string;
	readonly positions: DiagramPositions;
	readonly notes: readonly SharedStickyNote[];
}

export interface SessionSeed {
	readonly source: string;
	readonly positions: DiagramPositions;
	readonly notes: readonly SharedStickyNote[];
	readonly baseline: SessionBaseline | null;
}

export interface SessionSnapshot {
	readonly source: string;
	readonly positions: DiagramPositions;
	readonly notes: readonly SharedStickyNote[];
	readonly diagnostics: readonly ParseDiagnostic[];
	readonly tableCount: number;
	readonly refCount: number;
	readonly baseline: { readonly shareId: string } | null;
}

export type ClientSessionMessage =
	| { readonly type: "init"; readonly state: SessionSeed }
	| { readonly type: "reconnect" }
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

export type ServerSessionMessage =
	| { readonly type: "state-ack"; readonly state: SessionSnapshot }
	| { readonly type: "state-update"; readonly patch: Partial<SessionSnapshot> }
	| { readonly type: "focus"; readonly tableIds: readonly string[] }
	| { readonly type: "share-result"; readonly id: string }
	| { readonly type: "share-error"; readonly error: string }
	| { readonly type: "error"; readonly message: string }
	| { readonly type: "pong" };

export interface SessionPointer {
	readonly sessionId: string;
	readonly routeShareId: string | null;
	readonly routeIsDirty: boolean;
	readonly createdAt: number;
}
