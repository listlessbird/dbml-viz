import { Result } from "better-result";

import type { ParserClient } from "../../lib/parser-client.ts";
import type { ServerMessage, WorkspaceState } from "../workspace-types.ts";
import {
	createAvailabilityErrorResult,
	createParserUnreachableResult,
	unavailable,
	type WorkspaceMcpAvailabilityError,
} from "./errors.ts";

export interface CanvasPresence {
	readonly connected: boolean;
	readonly connectionCount: number;
}

export interface WorkspaceAvailabilityStatus {
	readonly workspaceActive: boolean;
	readonly canvasPresence: CanvasPresence;
	readonly updatedAt: number | null;
}

export interface WorkspaceMcpStatus extends WorkspaceAvailabilityStatus {
	readonly tableCount: number;
	readonly refCount: number;
	readonly diagnosticCount: number;
}

export interface WorkspaceAgentApi {
	readonly state: WorkspaceState | null;
	readonly canvasPresence: CanvasPresence;
	mutate(partial: Partial<WorkspaceState>): void;
	broadcast(message: ServerMessage): void;
}

interface WorkspaceMcpReady {
	readonly workspace: WorkspaceState;
	readonly status: WorkspaceAvailabilityStatus;
}

interface RequireWorkspaceOptions {
	readonly requireCanvasPresence?: boolean;
}

interface WorkspaceMcpContextOptions {
	readonly agent: WorkspaceAgentApi;
	readonly parserClient: ParserClient;
}

export const describeWorkspaceAvailability = (
	workspace: WorkspaceState | null,
	canvasPresence: CanvasPresence,
): WorkspaceAvailabilityStatus => ({
	workspaceActive: Boolean(workspace),
	canvasPresence,
	updatedAt: workspace?.updatedAt ?? null,
});

export const createWorkspaceMcpContext = ({
	agent,
	parserClient,
}: WorkspaceMcpContextOptions) => {
	const requireWorkspace = async ({
		requireCanvasPresence = false,
	}: RequireWorkspaceOptions = {}): Promise<
		Result<WorkspaceMcpReady, WorkspaceMcpAvailabilityError>
	> => {
		const workspace = agent.state;
		const status = describeWorkspaceAvailability(workspace, agent.canvasPresence);

		if (!workspace) {
			return Result.err(unavailable("workspace_not_active", status));
		}
		if (requireCanvasPresence && !status.canvasPresence.connected) {
			return Result.err(unavailable("canvas_not_connected", status));
		}

		return Result.ok({ workspace, status });
	};

	return {
		requireWorkspace,
		createAvailabilityErrorResult,
		parserClient,
		createParserUnreachableResult,
	};
};

export type WorkspaceMcpContext = ReturnType<typeof createWorkspaceMcpContext>;
