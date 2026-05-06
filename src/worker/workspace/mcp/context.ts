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

export interface WorkspaceMcpStatus {
	readonly workspaceActive: boolean;
	readonly canvasPresence: CanvasPresence;
	readonly updatedAt: number | null;
	readonly tableCount: number;
	readonly refCount: number;
	readonly diagnosticCount: number;
}

interface WorkspaceMcpReady {
	readonly workspace: WorkspaceState;
	readonly status: WorkspaceMcpStatus;
}

interface RequireWorkspaceOptions {
	readonly requireCanvasPresence?: boolean;
}

interface WorkspaceMcpContextOptions {
	readonly storage: WorkspaceStorage;
	readonly getCanvasPresence: () => CanvasPresence;
	readonly parserClient: ParserClient;
}

export const describeWorkspaceMcpStatus = (
	workspace: WorkspaceState | null,
	canvasPresence: CanvasPresence,
): WorkspaceMcpStatus => ({
	workspaceActive: Boolean(workspace),
	canvasPresence,
	updatedAt: workspace?.updatedAt ?? null,
	tableCount: workspace?.parsedTableCount ?? 0,
	refCount: workspace?.parsedRefCount ?? 0,
	diagnosticCount: workspace?.diagnostics.length ?? 0,
});

export const createWorkspaceMcpContext = ({
	storage,
	getCanvasPresence,
	parserClient,
}: WorkspaceMcpContextOptions) => {
	const getStatus = async (): Promise<WorkspaceMcpStatus> => {
		const workspace = await storage.load();
		return describeWorkspaceMcpStatus(workspace, getCanvasPresence());
	};

	const requireWorkspace = async ({
		requireCanvasPresence = false,
	}: RequireWorkspaceOptions = {}): Promise<
		Result<WorkspaceMcpReady, WorkspaceMcpAvailabilityError>
	> => {
		const workspace = await storage.load();
		const status = describeWorkspaceMcpStatus(workspace, getCanvasPresence());

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
		getStatus,
		requireWorkspace,
		createAvailabilityErrorResult,
		parserClient,
		createParserUnreachableResult,
	};
};

export type WorkspaceMcpContext = ReturnType<typeof createWorkspaceMcpContext>;
