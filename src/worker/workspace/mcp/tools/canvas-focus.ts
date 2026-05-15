import { Result } from "better-result";
import { z } from "zod";

import type { WorkspaceAgentApi, WorkspaceMcpContext } from "../context.ts";
import { toWorkspaceMcpResult } from "../result.ts";

const MAX_FOCUS_TABLE_IDS = 32;

export interface CanvasFocusInput {
	readonly tableIds: readonly string[];
}

const dedupeRequestedIds = (tableIds: readonly string[]): readonly string[] => {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const raw of tableIds) {
		const id = raw.trim();
		if (id.length === 0 || seen.has(id)) continue;
		seen.add(id);
		out.push(id);
	}
	return out;
};

export const runCanvasFocusTool = async (
	options: {
		readonly context: WorkspaceMcpContext;
		readonly agent: WorkspaceAgentApi;
	},
	input: CanvasFocusInput,
) => {
	const ready = await options.context.requireWorkspace({
		requireCanvasPresence: true,
	});
	if (Result.isError(ready)) {
		return options.context.createAvailabilityErrorResult(ready.error);
	}

	const requested = dedupeRequestedIds(input.tableIds);
	if (requested.length === 0) {
		return toWorkspaceMcpResult(
			Result.err({
				ok: false as const,
				reason: "invalid_focus_request" as const,
				message: "canvas_focus requires at least one Table id.",
				recovery:
					"Call schema_overview to discover Table ids and pass at least one in tableIds.",
			}),
		);
	}

	const { workspace, status } = ready.value;
	const parsed = await options.context.parserClient.parseSchemaSource(
		workspace.source,
	);

	if (Result.isError(parsed) && parsed.error._tag === "ParserUnreachableError") {
		return options.context.createParserUnreachableResult(parsed.error, status);
	}
	if (
		Result.isError(parsed) &&
		parsed.error._tag === "ParserInvalidResponseError"
	) {
		return options.context.createParserUnreachableResult(parsed.error, status);
	}

	const knownIds = Result.isOk(parsed)
		? new Set(parsed.value.parsed.tables.map((table) => table.id))
		: null;
	const parserAvailable = knownIds !== null;

	const focused: string[] = [];
	const unresolved: string[] = [];
	for (const id of requested) {
		if (knownIds === null || knownIds.has(id)) {
			focused.push(id);
		} else {
			unresolved.push(id);
		}
	}

	if (focused.length === 0) {
		return toWorkspaceMcpResult(
			Result.err({
				ok: false as const,
				reason: "unknown_focus_tables" as const,
				message:
					"None of the requested Tables exist in the current Parsed Schema.",
				recovery:
					"Call schema_overview to see current Table ids before retrying canvas_focus.",
				unresolvedTableIds: unresolved,
			}),
		);
	}

	options.agent.broadcast({ type: "focus", tableIds: focused });

	return toWorkspaceMcpResult(
		Result.ok({
			ok: true as const,
			freshness: { updatedAt: workspace.updatedAt },
			focusedTableIds: focused,
			unresolvedTableIds: unresolved,
			parserAvailable,
		}),
	);
};

export const canvasFocusTool = {
	name: "canvas_focus",
	config: {
		description:
			"Sends a Focus command that brings one or more Tables into the Canvas Viewport. Use after schema_overview to highlight relevant Tables for the user. Requires Canvas Presence. Validates Table ids against the current Parsed Schema when available; unresolved ids are reported in the result. Does not change Schema Source, Table Positions, Sticky Notes, Viewport persistence, or Selection. Do not use for Schema Editing or annotation.",
		inputSchema: {
			tableIds: z
				.array(z.string().min(1))
				.min(1)
				.max(MAX_FOCUS_TABLE_IDS)
				.describe(
					"One or more Table ids from schema_overview to bring into the Canvas Viewport.",
				),
		},
		outputSchema: {
			ok: z.literal(true),
			freshness: z.object({ updatedAt: z.number() }),
			focusedTableIds: z.array(z.string()),
			unresolvedTableIds: z.array(z.string()),
			parserAvailable: z.boolean(),
		},
	},
	handler:
		(options: {
			readonly context: WorkspaceMcpContext;
			readonly agent: WorkspaceAgentApi;
		}) =>
		(input: unknown) =>
			runCanvasFocusTool(options, input as CanvasFocusInput),
} as const;
