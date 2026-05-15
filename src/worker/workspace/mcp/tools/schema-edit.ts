import { Result } from "better-result";
import { z } from "zod";

import { toWorkspaceMcpResult } from "../result.ts";
import type { WorkspaceAgentApi, WorkspaceMcpContext } from "../context.ts";
import { MAX_SCHEMA_SOURCE_LENGTH } from "../../workspace-types.ts";

export interface SchemaEditInput {
	readonly knownSourceUpdatedAt: number;
	readonly oldString: string;
	readonly newString: string;
	readonly replaceAll?: boolean;
}

interface SingleChangeSummary {
	readonly startOffset: number;
	readonly endOffset: number;
	readonly startLine: number;
	readonly endLine: number;
	readonly oldLength: number;
	readonly newLength: number;
}

interface ReplaceAllChangeSummary extends SingleChangeSummary {
	readonly replacedAll: true;
	readonly occurrenceCount: number;
}

type SchemaEditChangeSummary = SingleChangeSummary | ReplaceAllChangeSummary;

type SchemaEditFailure =
	| {
			readonly ok: false;
			readonly reason: "no_op_edit";
			readonly message: string;
			readonly recovery: string;
	  }
	| {
			readonly ok: false;
			readonly reason: "old_string_not_found";
			readonly message: string;
			readonly recovery: string;
	  }
	| {
			readonly ok: false;
			readonly reason: "old_string_ambiguous";
			readonly message: string;
			readonly recovery: string;
			readonly occurrenceCount: number;
	  }
	| {
			readonly ok: false;
			readonly reason: "schema_source_too_large";
			readonly message: string;
			readonly recovery: string;
			readonly maxLength: number;
			readonly sourceLength: number;
	  };

interface SchemaEditApplied {
	readonly source: string;
	readonly change: SchemaEditChangeSummary;
}

const countLeadingLines = (source: string, offset: number): number => {
	let line = 1;
	for (let i = 0; i < offset; i += 1) {
		if (source.charCodeAt(i) === 10) line += 1;
	}
	return line;
};

export const applySchemaEdit = (
	source: string,
	oldString: string,
	newString: string,
	replaceAll: boolean,
): Result<SchemaEditApplied, SchemaEditFailure> => {
	if (oldString === newString) {
		return Result.err({
			ok: false,
			reason: "no_op_edit",
			message: "oldString and newString are identical; no edit was applied.",
			recovery:
				"Provide a newString that differs from oldString, or omit the edit if no change is needed.",
		});
	}

	const firstOffset = source.indexOf(oldString);
	if (firstOffset === -1) {
		return Result.err({
			ok: false,
			reason: "old_string_not_found",
			message:
				"oldString was not found in the current Schema Source; no edit was applied.",
			recovery:
				"Re-slice the specific region you want to edit (schema_source_slice with the table/relationship target, or a narrow lines window around your anchor) and copy the exact text — including whitespace, indentation, and line endings — as oldString. Do not widen oldString to the whole Schema Source.",
		});
	}

	let occurrenceCount = 1;
	for (
		let nextOffset = source.indexOf(oldString, firstOffset + oldString.length);
		nextOffset !== -1;
		nextOffset = source.indexOf(oldString, nextOffset + oldString.length)
	) {
		occurrenceCount += 1;
	}

	if (occurrenceCount > 1 && !replaceAll) {
		return Result.err({
			ok: false,
			reason: "old_string_ambiguous",
			message:
				"oldString matches more than one location in the current Schema Source; no edit was applied.",
			recovery:
				"Either expand oldString with more surrounding context so it matches exactly once, or set replaceAll: true to replace every occurrence.",
			occurrenceCount,
		});
	}

	const startLine = countLeadingLines(source, firstOffset);
	const newLineCount = newString.split("\n").length;
	const endLine = startLine + newLineCount - 1;

	const nextSource = replaceAll
		? source.split(oldString).join(newString)
		: source.slice(0, firstOffset) +
			newString +
			source.slice(firstOffset + oldString.length);

	if (nextSource.length > MAX_SCHEMA_SOURCE_LENGTH) {
		return Result.err({
			ok: false,
			reason: "schema_source_too_large",
			message: `Edited Schema Source exceeds ${MAX_SCHEMA_SOURCE_LENGTH} characters.`,
			recovery:
				"Shorten newString or split the edit into smaller pieces before retrying schema_edit.",
			maxLength: MAX_SCHEMA_SOURCE_LENGTH,
			sourceLength: nextSource.length,
		});
	}

	const baseChange: SingleChangeSummary = {
		startOffset: firstOffset,
		endOffset: firstOffset + oldString.length,
		startLine,
		endLine,
		oldLength: oldString.length,
		newLength: newString.length,
	};

	const change: SchemaEditChangeSummary =
		replaceAll && occurrenceCount > 1
			? { ...baseChange, replacedAll: true, occurrenceCount }
			: baseChange;

	return Result.ok({ source: nextSource, change });
};

export const runSchemaEditTool = async (
	options: {
		readonly context: WorkspaceMcpContext;
		readonly agent: WorkspaceAgentApi;
	},
	input: SchemaEditInput,
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
					"Re-slice only around your edit anchor (schema_source_slice with a narrow { kind: \"lines\", startLine, endLine } window, or the table/relationship target you are editing) to confirm oldString still matches, then retry schema_edit with the new freshness. You do not need to re-read the whole Schema Source.",
				currentUpdatedAt: workspace.updatedAt,
				knownSourceUpdatedAt: input.knownSourceUpdatedAt,
			}),
		);
	}

	if (input.oldString === "") {
		if (input.newString.length > MAX_SCHEMA_SOURCE_LENGTH) {
			return toWorkspaceMcpResult(
				Result.err({
					ok: false,
					reason: "schema_source_too_large",
					message: `Replacement Schema Source exceeds ${MAX_SCHEMA_SOURCE_LENGTH} characters.`,
					recovery:
						"Submit a shorter full replacement, or use schema_edit with a non-empty oldString for a targeted edit.",
					maxLength: MAX_SCHEMA_SOURCE_LENGTH,
					sourceLength: input.newString.length,
				}),
			);
		}

		const parsed = await options.context.parserClient.parseSchemaSource(
			input.newString,
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
						"Use the diagnostics below to fix the replacement source, then retry schema_edit with current Workspace freshness.",
					diagnostics: parsed.error.diagnostics,
				}),
			);
		}

		options.agent.mutate({ source: input.newString });
		const updatedAt = options.agent.state?.updatedAt ?? workspace.updatedAt;

		return toWorkspaceMcpResult(
			Result.ok({
				ok: true,
				freshness: { updatedAt },
				sourceSize: {
					oldLength: workspace.source.length,
					newLength: input.newString.length,
					oldLineCount:
						workspace.source.length === 0 ? 0 : workspace.source.split("\n").length,
					newLineCount:
						input.newString.length === 0 ? 0 : input.newString.split("\n").length,
				},
				diagnostics: [],
			}),
		);
	}

	const applied = applySchemaEdit(
		workspace.source,
		input.oldString,
		input.newString,
		input.replaceAll === true,
	);
	if (Result.isError(applied)) {
		return toWorkspaceMcpResult(Result.err(applied.error));
	}

	const parsed = await options.context.parserClient.parseSchemaSource(
		applied.value.source,
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
					"The edited schema has syntax or validation errors, so Schema Source was not changed.",
				recovery:
					"Use the diagnostics below to fix newString, then retry schema_edit with current Workspace freshness.",
				diagnostics: parsed.error.diagnostics,
			}),
		);
	}

	options.agent.mutate({ source: applied.value.source });
	const updatedAt = options.agent.state?.updatedAt ?? workspace.updatedAt;

	return toWorkspaceMcpResult(
		Result.ok({
			ok: true,
			freshness: { updatedAt },
			change: applied.value.change,
			diagnostics: [],
		}),
	);
};

const SCHEMA_EDIT_DESCRIPTION = [
	"Applies a single exact-string Schema Source Patch to the current Schema Source, after checking that the edited schema is valid.",
	"This is the default tool for Schema Editing: inspect with schema_source_slice first, then call schema_edit with an exact oldString and replacement newString.",
	"Keep oldString as small as possible while still matching exactly once — typically a single line or a short anchor block. Do NOT paste the entire Schema Source into oldString; that wastes tokens and re-broadcasts the whole source as if it were a fresh edit. Slice only around the region you intend to change.",
	"Matching is exact — whitespace, indentation, and line endings must match. The edit FAILS if oldString is not found (re-slice the region; do not widen to the whole source) and FAILS if oldString is found multiple times unless replaceAll: true is set; on ambiguous matches add one or two more lines of surrounding context, not the whole file.",
	"Use replaceAll: true to rename every occurrence of a symbol.",
	"Common workflows:",
	"  • Edit a single table or ref: oldString = the exact slice of that table/ref from schema_source_slice; newString = the replacement.",
	"  • Append a new table or ref: anchor on the LAST existing line you want to insert after (e.g. the final Ref line), and put both that anchor and the new content in newString. Do not paste the whole source.",
	"  • Rename a symbol everywhere: oldString = the symbol, replaceAll: true.",
	"  • Import / reset / broad redesign only: oldString = \"\" replaces the entire Schema Source with newString. Do not use the empty-oldString shape for an append or a single-table edit.",
	"For atomic multi-replacement (several edits that must all succeed or none), use schema_apply_patch instead.",
	"Requires Canvas Presence and current Workspace freshness. On any failure no source is changed and no Canvas update is broadcast.",
].join(" ");

export const schemaEditTool = {
	name: "schema_edit",
	config: {
		description: SCHEMA_EDIT_DESCRIPTION,
		inputSchema: {
			knownSourceUpdatedAt: z
				.number()
				.describe(
					"Workspace freshness value from schema_overview or schema_source_slice.",
				),
			oldString: z
				.string()
				.describe(
					"Exact current Schema Source text returned by schema_source_slice. Keep this as small as possible while still matching exactly once — usually a single line or short block, never the whole source. For appends, anchor on the last existing line you are inserting after. Use an empty string ONLY for import / reset / broad redesign of the entire Schema Source.",
				),
			newString: z
				.string()
				.describe(
					"Replacement Schema Source text. Must differ from oldString when oldString is non-empty.",
				),
			replaceAll: z
				.boolean()
				.optional()
				.describe(
					"When true, replace every exact occurrence of oldString. Ignored for the empty-oldString full-source overload.",
				),
		},
		outputSchema: {
			ok: z.literal(true),
			freshness: z.object({ updatedAt: z.number() }),
			change: z
				.object({
					startOffset: z.number().int().nonnegative(),
					endOffset: z.number().int().nonnegative(),
					startLine: z.number().int().positive(),
					endLine: z.number().int().positive(),
					oldLength: z.number().int().nonnegative(),
					newLength: z.number().int().nonnegative(),
					replacedAll: z.literal(true).optional(),
					occurrenceCount: z.number().int().positive().optional(),
				})
				.optional(),
			sourceSize: z
				.object({
					oldLength: z.number().int().nonnegative(),
					newLength: z.number().int().nonnegative(),
					oldLineCount: z.number().int().nonnegative(),
					newLineCount: z.number().int().nonnegative(),
				})
				.optional(),
			diagnostics: z.array(z.unknown()),
		},
	},
	handler:
		(options: {
			readonly context: WorkspaceMcpContext;
			readonly agent: WorkspaceAgentApi;
		}) =>
		(input: unknown) =>
			runSchemaEditTool(options, input as SchemaEditInput),
} as const;
