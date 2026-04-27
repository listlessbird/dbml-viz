import type { WorkspaceSeed, WorkspaceState } from "./workspace-types.ts";

export interface WorkspaceAttachRequest {
	readonly state: WorkspaceSeed;
	readonly updatedAt: number;
}

export type WorkspaceAttachDecision =
	| {
			readonly winner: "browser";
			readonly state: WorkspaceSeed;
			readonly updatedAt: number;
	  }
	| {
			readonly winner: "remote";
			readonly workspace: WorkspaceState;
	  };

export const decideWorkspaceAttach = (
	current: WorkspaceState | null,
	attach: WorkspaceAttachRequest,
): WorkspaceAttachDecision => {
	if (current && current.updatedAt > attach.updatedAt) {
		return { winner: "remote", workspace: current };
	}

	return {
		winner: "browser",
		state: attach.state,
		updatedAt: attach.updatedAt,
	};
};

