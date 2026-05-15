import { Result } from "better-result";
import { z } from "zod";

import { toWorkspaceMcpResult } from "../result.ts";
import type { WorkspaceAgentApi, WorkspaceMcpContext } from "../context.ts";
import { MAX_SCHEMA_SOURCE_LENGTH } from "../../workspace-types.ts";

export interface SchemaSourcePatchInput {
	readonly expectedCurrentText: string;
	readonly replacementText: string;
}

export interface SchemaApplyPatchInput {
	readonly knownSourceUpdatedAt: number;
	readonly patches: readonly SchemaSourcePatchInput[];
}

export interface SchemaPatchChangeSummary {
	readonly patchIndex: number;
	readonly startOffset: number;
	readonly endOffset: number;
	readonly startLine: number;
	readonly endLine: number;
	readonly oldLength: number;
	readonly newLength: number;
}

type SchemaPatchFailure = {
	readonly ok: false;
	readonly reason:
		| "invalid_schema_source_patch"
		| "expected_text_missing"
		| "expected_text_ambiguous"
		| "schema_source_too_large";
	readonly message: string;
	readonly recovery: string;
	readonly patchIndex?: number;
	readonly occurrenceCount?: number;
	readonly maxLength?: number;
	readonly sourceLength?: number;
};

export const applyExactSchemaSourcePatches = (
	source: string,
	patches: readonly SchemaSourcePatchInput[],
): Result<
	{
		readonly source: string;
		readonly changes: readonly SchemaPatchChangeSummary[];
	},
	SchemaPatchFailure
> => {
	if (patches.length === 0) {
		return Result.err({
			ok: false,
			reason: "invalid_schema_source_patch",
			message: "schema_apply_patch requires at least one patch.",
			recovery: "Provide one or more exact Schema Source Patch replacements.",
		});
	}

	const located: Array<
		SchemaPatchChangeSummary & {
			readonly expectedCurrentText: string;
			readonly replacementText: string;
		}
	> = [];

	for (const [patchIndex, patch] of patches.entries()) {
		if (patch.expectedCurrentText.length === 0) {
			return Result.err({
				ok: false,
				reason: "invalid_schema_source_patch",
				message: "expectedCurrentText must not be empty.",
				recovery:
					"Call schema_source_slice and use a non-empty exact source excerpt.",
				patchIndex,
			});
		}

		const startOffset = source.indexOf(patch.expectedCurrentText);
		if (startOffset === -1) {
			return Result.err({
				ok: false,
				reason: "expected_text_missing",
				message:
					"The expectedCurrentText for a Schema Source Patch was not found.",
				recovery:
					"Call schema_source_slice again and use the returned exact source text as expectedCurrentText.",
				patchIndex,
			});
		}

		const secondOffset = source.indexOf(
			patch.expectedCurrentText,
			startOffset + 1,
		);
		if (secondOffset !== -1) {
			let occurrenceCount = 2;
			for (
				let nextOffset = source.indexOf(
					patch.expectedCurrentText,
					secondOffset + 1,
				);
				nextOffset !== -1;
				nextOffset = source.indexOf(
					patch.expectedCurrentText,
					nextOffset + 1,
				)
			) {
				occurrenceCount += 1;
			}

			return Result.err({
				ok: false,
				reason: "expected_text_ambiguous",
				message:
					"The expectedCurrentText for a Schema Source Patch appears more than once.",
				recovery:
					"Call schema_source_slice for a narrower region and include more surrounding context in expectedCurrentText.",
				patchIndex,
				occurrenceCount,
			});
		}

		let startLine = 1;
		for (let i = 0; i < startOffset; i += 1) {
			if (source.charCodeAt(i) === 10) startLine += 1;
		}

		located.push({
			patchIndex,
			expectedCurrentText: patch.expectedCurrentText,
			replacementText: patch.replacementText,
			startOffset,
			endOffset: startOffset + patch.expectedCurrentText.length,
			startLine,
			endLine: startLine + patch.replacementText.split("\n").length - 1,
			oldLength: patch.expectedCurrentText.length,
			newLength: patch.replacementText.length,
		});
	}

	const sorted = [...located].sort((a, b) => a.startOffset - b.startOffset);
	for (let i = 1; i < sorted.length; i += 1) {
		if (sorted[i - 1].endOffset > sorted[i].startOffset) {
			return Result.err({
				ok: false,
				reason: "invalid_schema_source_patch",
				message: "Schema Source Patches must not overlap.",
				recovery: "Use a single replacement for the overlapping source region.",
				patchIndex: sorted[i].patchIndex,
			});
		}
	}

	const nextSource = [...located]
		.sort((a, b) => b.startOffset - a.startOffset)
		.reduce(
			(current, patch) =>
				current.slice(0, patch.startOffset) +
				patch.replacementText +
				current.slice(patch.endOffset),
			source,
		);

	if (nextSource.length > MAX_SCHEMA_SOURCE_LENGTH) {
		return Result.err({
			ok: false,
			reason: "schema_source_too_large",
			message: `Patched Schema Source exceeds ${MAX_SCHEMA_SOURCE_LENGTH} characters.`,
			recovery: "Apply a smaller patch or use a shorter replacement before retrying.",
			maxLength: MAX_SCHEMA_SOURCE_LENGTH,
			sourceLength: nextSource.length,
		});
	}

	return Result.ok({
		source: nextSource,
		changes: located.map((change) => ({
			patchIndex: change.patchIndex,
			startOffset: change.startOffset,
			endOffset: change.endOffset,
			startLine: change.startLine,
			endLine: change.endLine,
			oldLength: change.oldLength,
			newLength: change.newLength,
		})),
	});
};

export const runSchemaApplyPatchTool = async (
	options: {
		readonly context: WorkspaceMcpContext;
		readonly agent: WorkspaceAgentApi;
	},
	input: SchemaApplyPatchInput,
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
					"Call schema_source_slice again to inspect the current Schema Source before retrying schema_apply_patch.",
				currentUpdatedAt: workspace.updatedAt,
				knownSourceUpdatedAt: input.knownSourceUpdatedAt,
			}),
		);
	}

	const patched = applyExactSchemaSourcePatches(workspace.source, input.patches);
	if (Result.isError(patched)) {
		return toWorkspaceMcpResult(Result.err(patched.error));
	}

	const parsed = await options.context.parserClient.parseSchemaSource(
		patched.value.source,
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
					"Use the diagnostics below to fix the replacement text, then retry schema_apply_patch with current Workspace freshness.",
				diagnostics: parsed.error.diagnostics,
			}),
		);
	}

	options.agent.mutate({ source: patched.value.source });
	const updatedAt = options.agent.state?.updatedAt ?? workspace.updatedAt;

	return toWorkspaceMcpResult(
		Result.ok({
			ok: true,
			freshness: { updatedAt },
			changes: patched.value.changes,
			diagnostics: [],
		}),
	);
};

export const schemaApplyPatchTool = {
	name: "schema_apply_patch",
	config: {
		description:
			"Applies several exact Schema Source Patch replacements atomically: either all patches apply or none do. Reserved for the atomic multi-replacement case where N exact replacements must succeed together. For a single targeted edit, or for replacing the entire Schema Source, prefer schema_edit. Use schema_source_slice first to capture the exact current text for each patch. Requires Canvas Presence and current Workspace freshness. If any expectedCurrentText is missing, ambiguous, or the edited schema has diagnostics, no source is changed and no Canvas update is broadcast.",
		inputSchema: {
			knownSourceUpdatedAt: z
				.number()
				.describe(
					"Workspace freshness value from schema_overview or schema_source_slice.",
				),
			patches: z
				.array(
					z.object({
						expectedCurrentText: z
							.string()
							.min(1)
							.describe(
								"Exact current Schema Source text returned by schema_source_slice.",
							),
						replacementText: z
							.string()
							.describe("Replacement Schema Source text."),
					}),
				)
				.min(1)
				.describe("Atomic exact replacements to apply."),
		},
		outputSchema: {
			ok: z.literal(true),
			freshness: z.object({ updatedAt: z.number() }),
			changes: z.array(
				z.object({
					patchIndex: z.number().int().nonnegative(),
					startOffset: z.number().int().nonnegative(),
					endOffset: z.number().int().nonnegative(),
					startLine: z.number().int().positive(),
					endLine: z.number().int().positive(),
					oldLength: z.number().int().nonnegative(),
					newLength: z.number().int().nonnegative(),
				}),
			),
			diagnostics: z.array(z.unknown()),
		},
	},
	handler:
		(options: {
			readonly context: WorkspaceMcpContext;
			readonly agent: WorkspaceAgentApi;
		}) =>
		(input: unknown) =>
			runSchemaApplyPatchTool(options, input as SchemaApplyPatchInput),
} as const;
