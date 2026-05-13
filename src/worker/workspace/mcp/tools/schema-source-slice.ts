import { Result, TaggedError } from "better-result";
import { z } from "zod";

import {
	toWorkspaceMcpResult,
} from "../result.ts";
import type { WorkspaceMcpContext } from "../context.ts";
import type {
	ParserClientError,
	ParserDiagnostic,
	ParserParseOk,
} from "../../../lib/parser-client.ts";
import type { WorkspaceState } from "../../workspace-types.ts";

export const DEFAULT_SLICE_MAX_LINES = 200;
export const DEFAULT_DIAGNOSTIC_CONTEXT_LINES = 3;

export type SliceTargetInput =
	| { readonly kind: "table"; readonly tableId: string }
	| { readonly kind: "relationship"; readonly relationshipId: string }
	| {
			readonly kind: "diagnostic";
			readonly index: number;
			readonly contextLines?: number;
	  }
	| {
			readonly kind: "lines";
			readonly startLine: number;
			readonly endLine: number;
	  };

export interface SchemaSourceSliceInput {
	readonly target: SliceTargetInput;
	readonly maxLines?: number;
}

class SliceTargetNotFoundError extends TaggedError("SliceTargetNotFoundError")<{
	readonly reason: "slice_target_not_found";
	readonly message: string;
	readonly recovery: string;
}>() {
	constructor(message: string, recovery: string) {
		super({ reason: "slice_target_not_found", message, recovery });
	}
}

class SliceLineRangeInvalidError extends TaggedError(
	"SliceLineRangeInvalidError",
)<{
	readonly reason: "slice_line_range_invalid";
	readonly message: string;
	readonly recovery: string;
}>() {
	constructor(message: string) {
		super({
			reason: "slice_line_range_invalid",
			message,
			recovery:
				"Provide a startLine ≥ 1 and an endLine ≥ startLine within the source.",
		});
	}
}

type SliceResolutionError =
	| SliceTargetNotFoundError
	| SliceLineRangeInvalidError;

export interface ExtractedLineRange {
	readonly text: string;
	readonly startLine: number;
	readonly endLine: number;
	readonly startOffset: number;
	readonly endOffset: number;
}

export const extractLineRange = (
	source: string,
	startLine: number,
	endLine: number,
): ExtractedLineRange => {
	const lines = source.split("\n");
	const total = lines.length;
	const safeStart = Math.max(1, Math.min(startLine, total));
	const safeEnd = Math.max(safeStart, Math.min(endLine, total));

	let startOffset = 0;
	for (let i = 0; i < safeStart - 1; i += 1) {
		startOffset += lines[i].length + 1;
	}

	let endOffset = startOffset;
	for (let i = safeStart - 1; i < safeEnd; i += 1) {
		endOffset += lines[i].length;
		if (i < safeEnd - 1) {
			endOffset += 1;
		}
	}

	return {
		text: lines.slice(safeStart - 1, safeEnd).join("\n"),
		startLine: safeStart,
		endLine: safeEnd,
		startOffset,
		endOffset,
	};
};

export const numberSourceLines = (text: string, startLine: number): string => {
	const lines = text.split("\n");
	const lastLineNumber = startLine + lines.length - 1;
	const width = String(lastLineNumber).length;
	return lines
		.map((line, index) => `${String(startLine + index).padStart(width, " ")}: ${line}`)
		.join("\n");
};

interface ResolvedTargetLines {
	readonly startLine: number;
	readonly endLine: number;
}

const resolveTargetLines = (
	target: SliceTargetInput,
	parsed: ParserParseOk | null,
	diagnostics: readonly ParserDiagnostic[],
): Result<ResolvedTargetLines, SliceResolutionError> => {
	if (target.kind === "lines") {
		if (target.startLine < 1 || target.endLine < target.startLine) {
			return Result.err(
				new SliceLineRangeInvalidError(
					`Invalid line range: startLine=${target.startLine}, endLine=${target.endLine}.`,
				),
			);
		}
		return Result.ok({ startLine: target.startLine, endLine: target.endLine });
	}

	if (target.kind === "diagnostic") {
		const diagnostic = diagnostics[target.index];
		if (!diagnostic) {
			return Result.err(
				new SliceTargetNotFoundError(
					`No diagnostic at index ${target.index}.`,
					"Call schema_overview to see the current diagnostics list and choose a valid index.",
				),
			);
		}
		const line = diagnostic.location?.start.line;
		if (typeof line !== "number") {
			return Result.err(
				new SliceTargetNotFoundError(
					`Diagnostic at index ${target.index} has no source location.`,
					"Use a 'lines' target to read a bounded line range instead.",
				),
			);
		}
		const context = target.contextLines ?? DEFAULT_DIAGNOSTIC_CONTEXT_LINES;
		return Result.ok({
			startLine: Math.max(1, line - context),
			endLine: line + context,
		});
	}

	if (!parsed?.sourceRanges) {
		return Result.err(
			new SliceTargetNotFoundError(
				"Source range metadata is unavailable for this Schema Source.",
				"Use a 'lines' target to read a bounded line range instead.",
			),
		);
	}

	const range =
		target.kind === "table"
			? parsed.sourceRanges.tablesById[target.tableId]
			: parsed.sourceRanges.refsById[target.relationshipId];

	if (!range) {
		const id =
			target.kind === "table" ? target.tableId : target.relationshipId;
		return Result.err(
			new SliceTargetNotFoundError(
				`No source range found for ${target.kind} '${id}'.`,
				"Call schema_overview to see the current ids, or use a 'lines' target instead.",
			),
		);
	}

	return Result.ok({ startLine: range.start.line, endLine: range.end.line });
};

const createSliceResolutionErrorResult = (error: SliceResolutionError) =>
	toWorkspaceMcpResult(
		Result.err({
			ok: false,
			reason: error.reason,
			message: error.message,
			recovery: error.recovery,
		}),
	);

const tryParse = async (
	context: WorkspaceMcpContext,
	workspace: WorkspaceState,
): Promise<
	| { kind: "ok"; parsed: ParserParseOk; diagnostics: readonly ParserDiagnostic[] }
	| { kind: "syntax"; diagnostics: readonly ParserDiagnostic[] }
	| { kind: "unreachable"; error: ParserClientError }
> => {
	const result = await context.parserClient.parseSchemaSource(workspace.source);
	if (Result.isOk(result)) {
		return { kind: "ok", parsed: result.value, diagnostics: [] };
	}
	if (result.error._tag === "ParserSyntaxError") {
		return { kind: "syntax", diagnostics: result.error.diagnostics };
	}
	return { kind: "unreachable", error: result.error };
};

export const runSchemaSourceSliceTool = async (
	context: WorkspaceMcpContext,
	input: SchemaSourceSliceInput,
) => {
	const ready = await context.requireWorkspace();
	if (Result.isError(ready)) {
		return context.createAvailabilityErrorResult(ready.error);
	}

	const { workspace, status } = ready.value;
	const parseOutcome = await tryParse(context, workspace);

	if (parseOutcome.kind === "unreachable") {
		return context.createParserUnreachableResult(parseOutcome.error, status);
	}

	const parsed = parseOutcome.kind === "ok" ? parseOutcome.parsed : null;
	const diagnostics = parseOutcome.diagnostics;
	const resolution = resolveTargetLines(input.target, parsed, diagnostics);
	if (Result.isError(resolution)) {
		return createSliceResolutionErrorResult(resolution.error);
	}

	const maxLines = input.maxLines ?? DEFAULT_SLICE_MAX_LINES;
	const requestedSpan = resolution.value.endLine - resolution.value.startLine + 1;
	const truncated = requestedSpan > maxLines;
	const effectiveEnd = truncated
		? resolution.value.startLine + maxLines - 1
		: resolution.value.endLine;

	const slice = extractLineRange(
		workspace.source,
		resolution.value.startLine,
		effectiveEnd,
	);

	return toWorkspaceMcpResult(
		Result.ok({
			ok: true,
			freshness: { updatedAt: workspace.updatedAt },
			target: input.target,
			range: {
				startLine: slice.startLine,
				endLine: slice.endLine,
				startOffset: slice.startOffset,
				endOffset: slice.endOffset,
			},
			source: slice.text,
			numberedSource: numberSourceLines(slice.text, slice.startLine),
			truncated,
			...(truncated
				? {
						truncationGuidance: `Slice exceeds maxLines=${maxLines}; request a narrower line range or a specific table/relationship target.`,
					}
				: {}),
		}),
	);
};

export const schemaSourceSliceTool = {
	name: "schema_source_slice",
	config: {
		description:
			"Returns a bounded Schema Source Slice with line numbers, exact text suitable as oldString for schema_edit (or expectedCurrentText for schema_apply_patch), and current Workspace freshness. Use this — not full Schema Source — to inspect a specific Table, Relationship, diagnostic, or line range. Pick a target after schema_overview. target must be an object of one of these shapes: { kind: \"table\", tableId } | { kind: \"relationship\", relationshipId } | { kind: \"diagnostic\", index, contextLines? } | { kind: \"lines\", startLine, endLine } — never a bare id string, and never a JSON-stringified value. If the response is truncated, request a narrower target. When preparing a schema_edit call, slice only around the region you are about to change (the specific table/relationship, or a narrow lines window around your anchor) — do not read the whole source just to build oldString. Reading the entire Schema Source is reserved for review/export workflows; in that case, paginate by calling schema_source_slice repeatedly with { kind: \"lines\", startLine, endLine }, advancing startLine/endLine each call and watching the truncated flag and maxLines cap.",
		inputSchema: {
			target: z
				.discriminatedUnion("kind", [
					z.object({
						kind: z.literal("table"),
						tableId: z.string().describe("Table id from schema_overview"),
					}),
					z.object({
						kind: z.literal("relationship"),
						relationshipId: z
							.string()
							.describe("Relationship id from schema_overview"),
					}),
					z.object({
						kind: z.literal("diagnostic"),
						index: z
							.number()
							.int()
							.nonnegative()
							.describe("Index into schema_overview.diagnostics"),
						contextLines: z.number().int().nonnegative().optional(),
					}),
					z.object({
						kind: z.literal("lines"),
						startLine: z.number().int().min(1),
						endLine: z.number().int().min(1),
					}),
				])
				.describe(
					'Slice target as a discriminated union on `kind`. Use { kind: "table", tableId } or { kind: "relationship", relationshipId } with ids from schema_overview; { kind: "diagnostic", index, contextLines? } to read around a parser diagnostic; { kind: "lines", startLine, endLine } for a raw 1-based line range (also the pagination shape for reading the whole source). Passing a bare id string is invalid.',
				),
			maxLines: z
				.number()
				.int()
				.positive()
				.max(2000)
				.optional()
				.describe(
					`Soft cap on returned lines; defaults to ${DEFAULT_SLICE_MAX_LINES}.`,
				),
		},
		annotations: { readOnlyHint: true },
	},
	handler:
		(context: WorkspaceMcpContext) =>
		(input: unknown) =>
			runSchemaSourceSliceTool(context, input as SchemaSourceSliceInput),
} as const;
