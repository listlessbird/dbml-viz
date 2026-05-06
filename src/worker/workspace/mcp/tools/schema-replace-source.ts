import { Result } from "better-result";
import { z } from "zod";

import {
	toWorkspaceMcpResult,
} from "../result.ts";
import type { WorkspaceMcpContext } from "../context.ts";
import type { WorkspaceStorage } from "../../workspace-storage.ts";
import {
	MAX_SCHEMA_SOURCE_LENGTH,
	type ServerMessage,
} from "../../workspace-types.ts";

export interface SchemaReplaceSourceInput {
	readonly knownSourceUpdatedAt: number;
	readonly source: string;
}

export const runSchemaReplaceSourceTool = async (
	options: {
		readonly context: WorkspaceMcpContext;
		readonly storage: WorkspaceStorage;
		readonly broadcast: (message: ServerMessage) => void;
	},
	input: SchemaReplaceSourceInput,
) => {
	const ready = await options.context.requireWorkspace({
		requireCanvasPresence: true,
	});
	if (Result.isError(ready)) {
		return options.context.createAvailabilityErrorResult(ready.error);
	}

	const { workspace, status } = ready.value;
	if (workspace.updatedAt !== input.knownSourceUpdatedAt) {
		return toWorkspaceMcpResult(
			Result.err({
				ok: false,
				reason: "stale_workspace_freshness",
				message:
					"The Workspace freshness value is stale; Schema Source was not changed.",
				recovery:
					"Call workspace_status or schema_overview again before retrying schema_replace_source.",
				currentUpdatedAt: workspace.updatedAt,
				knownSourceUpdatedAt: input.knownSourceUpdatedAt,
			}),
		);
	}

	if (input.source.length > MAX_SCHEMA_SOURCE_LENGTH) {
		return toWorkspaceMcpResult(
			Result.err({
				ok: false,
				reason: "schema_source_too_large",
				message: `Replacement Schema Source exceeds ${MAX_SCHEMA_SOURCE_LENGTH} characters.`,
				recovery:
					"Submit a shorter full replacement, or use schema_apply_patch for targeted Schema Editing.",
				maxLength: MAX_SCHEMA_SOURCE_LENGTH,
				sourceLength: input.source.length,
			}),
		);
	}

	const parsed = await options.context.parserClient.parseSchemaSource(
		input.source,
	);
	if (Result.isError(parsed) && parsed.error._tag !== "ParserSyntaxError") {
		return options.context.createParserUnreachableResult(parsed.error, status);
	}
	if (Result.isError(parsed) && parsed.error._tag === "ParserSyntaxError") {
		return toWorkspaceMcpResult(
			Result.err({
				ok: false,
				reason: "schema_parse_failed",
				message:
					"The replacement schema has syntax or validation errors, so Schema Source was not changed.",
				recovery:
					"Use the diagnostics below to fix the replacement source, then retry schema_replace_source with current Workspace freshness.",
				diagnostics: parsed.error.diagnostics,
			}),
		);
	}

	await options.storage.saveAgentMutation({ source: input.source });
	const updatedAt = options.storage.cached?.updatedAt ?? workspace.updatedAt;
	options.broadcast({
		type: "state-update",
		patch: { source: input.source, updatedAt },
	});

	return toWorkspaceMcpResult(
		Result.ok({
			ok: true,
			freshness: { updatedAt },
			sourceSize: {
				oldLength: workspace.source.length,
				newLength: input.source.length,
				oldLineCount:
					workspace.source.length === 0 ? 0 : workspace.source.split("\n").length,
				newLineCount:
					input.source.length === 0 ? 0 : input.source.split("\n").length,
			},
			diagnostics: [],
		}),
	);
};

export const schemaReplaceSourceTool = {
	name: "schema_replace_source",
	config: {
		description:
			"Replaces the entire Schema Source after checking that the replacement schema is valid. Use for import, reset, broad redesign, or an explicit user-requested full replacement. Requires Canvas Presence and current Workspace freshness. Do not use for targeted edits; use schema_source_slice then schema_apply_patch instead. If diagnostics are returned, no source is changed and no Canvas update is broadcast.",
		inputSchema: {
			knownSourceUpdatedAt: z
				.number()
				.describe(
					"Workspace freshness value from workspace_status, schema_overview, or schema_source_slice.",
				),
			source: z
				.string()
				.max(MAX_SCHEMA_SOURCE_LENGTH)
				.describe("Complete replacement DBML or SQL Schema Source."),
		},
		outputSchema: {
			ok: z.literal(true),
			freshness: z.object({ updatedAt: z.number() }),
			sourceSize: z.object({
				oldLength: z.number().int().nonnegative(),
				newLength: z.number().int().nonnegative(),
				oldLineCount: z.number().int().nonnegative(),
				newLineCount: z.number().int().nonnegative(),
			}),
			diagnostics: z.array(z.unknown()),
		},
	},
	handler:
		(options: {
			readonly context: WorkspaceMcpContext;
			readonly storage: WorkspaceStorage;
			readonly broadcast: (message: ServerMessage) => void;
		}) =>
		(input: unknown) =>
			runSchemaReplaceSourceTool(options, input as SchemaReplaceSourceInput),
} as const;
