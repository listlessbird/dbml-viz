import { Result, TaggedError } from "better-result";

import type { ParserClientError } from "../../lib/parser-client.ts";
import type { WorkspaceAvailabilityStatus } from "./context.ts";
import { toWorkspaceMcpResult } from "./result.ts";

export type WorkspaceMcpUnavailableReason =
	| "workspace_not_active"
	| "canvas_not_connected";

export class WorkspaceNotActiveError extends TaggedError(
	"WorkspaceNotActiveError",
)<{
	readonly reason: "workspace_not_active";
	readonly message: string;
	readonly recovery: string;
	readonly status: WorkspaceAvailabilityStatus;
}>() {
	constructor(status: WorkspaceAvailabilityStatus) {
		super({
			reason: "workspace_not_active",
			message: "No active Workspace exists.",
			recovery:
				"Ask the user to connect a Workspace, then call workspace_status again.",
			status,
		});
	}
}

export class CanvasNotConnectedError extends TaggedError(
	"CanvasNotConnectedError",
)<{
	readonly reason: "canvas_not_connected";
	readonly message: string;
	readonly recovery: string;
	readonly status: WorkspaceAvailabilityStatus;
}>() {
	constructor(status: WorkspaceAvailabilityStatus) {
		super({
			reason: "canvas_not_connected",
			message:
				"The Workspace exists, but no browser Canvas is currently connected.",
			recovery:
				"Ask the user to reconnect the Canvas, then retry the Canvas-bound tool.",
			status,
		});
	}
}

export type WorkspaceMcpAvailabilityError =
	| WorkspaceNotActiveError
	| CanvasNotConnectedError;

export const unavailable = (
	reason: WorkspaceMcpUnavailableReason,
	status: WorkspaceAvailabilityStatus,
): WorkspaceMcpAvailabilityError =>
	reason === "workspace_not_active"
		? new WorkspaceNotActiveError(status)
		: new CanvasNotConnectedError(status);

export const createAvailabilityErrorResult = (
	error: WorkspaceMcpAvailabilityError,
) =>
	toWorkspaceMcpResult(
		Result.err({
			ok: false,
			reason: error.reason,
			message: error.message,
			recovery: error.recovery,
			status: error.status,
		}),
	);

export const createParserUnreachableResult = (
	error: ParserClientError,
	status: WorkspaceAvailabilityStatus,
) =>
	toWorkspaceMcpResult(
		Result.err({
			ok: false,
			reason: "parser_unavailable",
			message: error.message,
			recovery: "Retry the call shortly.",
			status,
		}),
	);
