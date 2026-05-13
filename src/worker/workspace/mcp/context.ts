import { Result } from "better-result";

import type { ParserClient } from "../../lib/parser-client.ts";
import type { WorkspaceStorage } from "../workspace-storage.ts";
import type { WorkspaceState } from "../workspace-types.ts";
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

interface WorkspaceMcpReady {
	readonly workspace: WorkspaceState;
	readonly status: WorkspaceAvailabilityStatus;
}

interface RequireWorkspaceOptions {
	readonly requireCanvasPresence?: boolean;
}

interface WorkspaceMcpContextOptions {
	readonly storage: WorkspaceStorage;
	readonly getCanvasPresence: () => CanvasPresence;
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
	storage,
	getCanvasPresence,
	parserClient,
}: WorkspaceMcpContextOptions) => {
	const requireWorkspace = async ({
		requireCanvasPresence = false,
	}: RequireWorkspaceOptions = {}): Promise<
		Result<WorkspaceMcpReady, WorkspaceMcpAvailabilityError>
	> => {
		const workspace = await storage.load();
		const status = describeWorkspaceAvailability(workspace, getCanvasPresence());

		if (!workspace) {
			return Result.err(unavailable("workspace_not_active", status));
		}
		if (requireCanvasPresence && !status.canvasPresence.connected) {
			return Result.err(unavailable("canvas_not_connected", status));
		}

		await storage.touch();
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
