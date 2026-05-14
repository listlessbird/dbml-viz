import { Result } from "better-result";
import { nanoid } from "nanoid";
import { z } from "zod";

import type {
	ParserParsedSchema,
	ParserDiagnostic,
} from "../../../lib/parser-client.ts";
import type { WorkspaceMcpContext } from "../context.ts";
import { toWorkspaceMcpResult } from "../result.ts";
import type { WorkspaceStorage } from "../../workspace-storage.ts";
import type {
	ServerMessage,
	SharedStickyNote,
} from "../../workspace-types.ts";

const MAX_NOTE_OVERVIEW_RESULTS = 50;
const MAX_NOTE_OPERATIONS = 32;
const MAX_NOTE_TEXT_LENGTH = 4000;
const NOTE_TEXT_PREVIEW_LENGTH = 120;
const NOTE_LINK_PATTERN = /#([A-Za-z_][\w]*)(?:\.([A-Za-z_][\w]*))?/g;
const stickyNoteColors = ["yellow", "pink", "blue", "green"] as const;

const noteMentionSchema = z.object({
	token: z.string(),
	table: z.string(),
	column: z.string().optional(),
	resolved: z.boolean().nullable(),
});

const noteSummarySchema = z.object({
	id: z.string(),
	color: z.enum(stickyNoteColors),
	textPreview: z.string(),
	textLength: z.number().int().nonnegative(),
	textHash: z.string(),
	text: z.string().optional(),
	mentions: z.array(noteMentionSchema),
	unresolvedMentionCount: z.number().int().nonnegative(),
});

export interface NotesOverviewInput {
	readonly noteIds?: readonly string[];
	readonly mentionedTable?: string;
	readonly mentionedColumn?: {
		readonly table: string;
		readonly column: string;
	};
	readonly unresolvedOnly?: boolean;
	readonly textSearch?: string;
	readonly responseFormat?: "concise" | "detailed";
}

type NoteColor = (typeof stickyNoteColors)[number];

type NotesApplyOperation =
	| {
			readonly type: "create";
			readonly text: string;
			readonly color?: NoteColor;
	  }
	| {
			readonly type: "edit_text";
			readonly noteId: string;
			readonly oldString: string;
			readonly newString: string;
			readonly replaceAll?: boolean;
	  }
	| {
			readonly type: "replace_text";
			readonly noteId: string;
			readonly expectedText?: string;
			readonly expectedTextHash?: string;
			readonly newText: string;
	  }
	| {
			readonly type: "update_color";
			readonly noteId: string;
			readonly color: NoteColor;
	  }
	| {
			readonly type: "delete";
			readonly noteId: string;
			readonly expectedText?: string;
			readonly expectedTextHash?: string;
	  };

export interface NotesApplyChangesInput {
	readonly knownWorkspaceUpdatedAt: number;
	readonly operations: readonly NotesApplyOperation[];
}

type NotesApplyFailure = {
	readonly ok: false;
	readonly reason: string;
	readonly message: string;
	readonly recovery: string;
	readonly [key: string]: unknown;
};

interface NoteMention {
	readonly token: string;
	readonly table: string;
	readonly column?: string;
	readonly resolved: boolean | null;
}

interface NoteSummary {
	readonly id: string;
	readonly color: SharedStickyNote["color"];
	readonly textPreview: string;
	readonly textLength: number;
	readonly textHash: string;
	readonly text?: string;
	readonly mentions: readonly NoteMention[];
	readonly unresolvedMentionCount: number;
}

const createTextHash = (text: string): string => {
	let hash = 2166136261;
	for (let i = 0; i < text.length; i += 1) {
		hash ^= text.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return `${text.length}:${(hash >>> 0).toString(16)}`;
};

const createSchemaMentionValidator = (
	parsed: ParserParsedSchema,
): ((table: string, column?: string) => boolean) => {
	const tables = new Map<string, Set<string>>();
	for (const table of parsed.tables) {
		const columns = new Set(table.columns.map((column) => column.name));
		tables.set(table.id, columns);
		tables.set(table.name, columns);
	}

	return (table, column) => {
		const columns = tables.get(table);
		if (!columns) return false;
		if (!column) return true;
		return columns.has(column);
	};
};

const parseNoteMentions = (
	text: string,
	isValid: ((table: string, column?: string) => boolean) | null,
): readonly NoteMention[] => {
	const seen = new Set<string>();
	const out: NoteMention[] = [];
	for (const match of text.matchAll(NOTE_LINK_PATTERN)) {
		const [token, table, column] = match;
		const key = column ? `${table}.${column}` : table;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({
			token,
			table,
			...(column !== undefined ? { column } : {}),
			resolved: isValid ? isValid(table, column) : null,
		});
	}
	return out;
};

const createNoteSummary = ({
	note,
	mentions,
	responseFormat,
}: {
	readonly note: SharedStickyNote;
	readonly mentions: readonly NoteMention[];
	readonly responseFormat: "concise" | "detailed";
}): NoteSummary => ({
	id: note.id,
	color: note.color,
	textPreview:
		note.text.length > NOTE_TEXT_PREVIEW_LENGTH
			? `${note.text.slice(0, NOTE_TEXT_PREVIEW_LENGTH)}...`
			: note.text,
	textLength: note.text.length,
	textHash: createTextHash(note.text),
	...(responseFormat === "detailed" ? { text: note.text } : {}),
	mentions,
	unresolvedMentionCount: mentions.filter(
		(mention) => mention.resolved === false,
	).length,
});

const filterNoteSummaries = (
	summaries: readonly NoteSummary[],
	input: NotesOverviewInput,
): readonly NoteSummary[] => {
	const noteIds = input.noteIds ? new Set(input.noteIds) : null;
	const textSearch = input.textSearch?.trim().toLocaleLowerCase();
	return summaries.filter((summary) => {
		if (noteIds && !noteIds.has(summary.id)) return false;
		if (input.mentionedTable) {
			const mentionsTable = summary.mentions.some(
				(mention) => mention.table === input.mentionedTable,
			);
			if (!mentionsTable) return false;
		}
		if (input.mentionedColumn) {
			const mentionsColumn = summary.mentions.some(
				(mention) =>
					mention.table === input.mentionedColumn?.table &&
					mention.column === input.mentionedColumn.column,
			);
			if (!mentionsColumn) return false;
		}
		if (input.unresolvedOnly === true && summary.unresolvedMentionCount === 0) {
			return false;
		}
		if (
			textSearch &&
			!summary.textPreview.toLocaleLowerCase().includes(textSearch) &&
			!summary.text?.toLocaleLowerCase().includes(textSearch)
		) {
			return false;
		}
		return true;
	});
};

const validateNoteText = (
	text: string,
): Result<void, NotesApplyFailure> => {
	if (text.trim().length === 0) {
		return Result.err({
			ok: false,
			reason: "invalid_note_text",
			message: "Sticky Note text must not be empty.",
			recovery: "Provide non-empty Sticky Note text.",
		});
	}
	if (text.length > MAX_NOTE_TEXT_LENGTH) {
		return Result.err({
			ok: false,
			reason: "invalid_note_text",
			message: `Sticky Note text exceeds ${MAX_NOTE_TEXT_LENGTH} characters.`,
			recovery:
				"Shorten the note text or split the reasoning across multiple notes.",
		});
	}
	return Result.ok(undefined);
};

const findNoteIndex = (
	notes: readonly SharedStickyNote[],
	noteId: string,
): Result<number, NotesApplyFailure> => {
	const index = notes.findIndex((note) => note.id === noteId);
	if (index === -1) {
		return Result.err({
			ok: false,
			reason: "note_not_found",
			message: `Sticky Note ${noteId} does not exist.`,
			recovery:
				"Call notes_overview to inspect current Sticky Note ids, then retry notes_apply_changes.",
			noteId,
		});
	}
	return Result.ok(index);
};

const assertExpectedText = (
	note: SharedStickyNote,
	operation: {
		readonly expectedText?: string;
		readonly expectedTextHash?: string;
		readonly noteId: string;
	},
): Result<void, NotesApplyFailure> => {
	if (
		operation.expectedText === undefined &&
		operation.expectedTextHash === undefined
	) {
		return Result.err({
			ok: false as const,
			reason: "expected_note_text_required" as const,
			message:
				"Expected note text or text hash is required for this Sticky Note operation.",
			recovery:
				"Call notes_overview with responseFormat: \"detailed\" for the note, then retry with expectedText or expectedTextHash.",
			noteId: operation.noteId,
		});
	}
	if (
		operation.expectedText !== undefined &&
		note.text !== operation.expectedText
	) {
		return Result.err({
			ok: false as const,
			reason: "expected_note_text_mismatch" as const,
			message:
				"Sticky Note text changed since inspection; no note changes were applied.",
			recovery:
				"Call notes_overview again for the current note text, then retry notes_apply_changes.",
			noteId: operation.noteId,
		});
	}
	if (
		operation.expectedTextHash !== undefined &&
		createTextHash(note.text) !== operation.expectedTextHash
	) {
		return Result.err({
			ok: false as const,
			reason: "expected_note_text_mismatch" as const,
			message:
				"Sticky Note text hash changed since inspection; no note changes were applied.",
			recovery:
				"Call notes_overview again for the current note text hash, then retry notes_apply_changes.",
			noteId: operation.noteId,
		});
	}
	return Result.ok(undefined);
};

const editNoteText = (
	note: SharedStickyNote,
	operation: Extract<NotesApplyOperation, { readonly type: "edit_text" }>,
): Result<SharedStickyNote, NotesApplyFailure> => {
	if (operation.oldString === operation.newString) {
		return Result.err({
			ok: false as const,
			reason: "no_op_note_edit" as const,
			message: "oldString and newString are identical; no note edit was applied.",
			recovery:
				"Provide a newString that differs from oldString, or omit the note operation.",
			noteId: operation.noteId,
		});
	}

	const firstOffset = note.text.indexOf(operation.oldString);
	if (firstOffset === -1) {
		return Result.err({
			ok: false as const,
			reason: "old_string_not_found" as const,
			message:
				"oldString was not found in the current Sticky Note text; no note changes were applied.",
			recovery:
				"Call notes_overview with responseFormat: \"detailed\" for this note and copy the exact current text before retrying.",
			noteId: operation.noteId,
		});
	}

	let occurrenceCount = 1;
	for (
		let nextOffset = note.text.indexOf(
			operation.oldString,
			firstOffset + operation.oldString.length,
		);
		nextOffset !== -1;
		nextOffset = note.text.indexOf(
			operation.oldString,
			nextOffset + operation.oldString.length,
		)
	) {
		occurrenceCount += 1;
	}

	if (occurrenceCount > 1 && operation.replaceAll !== true) {
		return Result.err({
			ok: false as const,
			reason: "old_string_ambiguous" as const,
			message:
				"oldString matches more than one location in the Sticky Note text; no note changes were applied.",
			recovery:
				"Expand oldString with surrounding text so it matches exactly once, or set replaceAll: true.",
			noteId: operation.noteId,
			occurrenceCount,
		});
	}

	const text =
		operation.replaceAll === true
			? note.text.split(operation.oldString).join(operation.newString)
			: note.text.slice(0, firstOffset) +
				operation.newString +
				note.text.slice(firstOffset + operation.oldString.length);
	return Result.ok({ ...note, text });
};

export const runNotesOverviewTool = async (
	context: WorkspaceMcpContext,
	input: NotesOverviewInput,
) => {
	const ready = await context.requireWorkspace();
	if (Result.isError(ready)) {
		return context.createAvailabilityErrorResult(ready.error);
	}

	const { workspace } = ready.value;
	const parsed = await context.parserClient.parseSchemaSource(workspace.source);
	let isValidMention: ((table: string, column?: string) => boolean) | null = null;
	let diagnostics: readonly ParserDiagnostic[] = [];

	if (Result.isOk(parsed)) {
		isValidMention = createSchemaMentionValidator(parsed.value.parsed);
	} else if (parsed.error._tag === "ParserSyntaxError") {
		diagnostics = parsed.error.diagnostics;
	} else if (input.unresolvedOnly === true) {
		return context.createParserUnreachableResult(parsed.error, ready.value.status);
	}

	const responseFormat = input.responseFormat ?? "concise";
	const summaries = workspace.notes.map((note) =>
		createNoteSummary({
			note,
			mentions: parseNoteMentions(note.text, isValidMention),
			responseFormat,
		}),
	);
	const filtered = filterNoteSummaries(summaries, input);
	const returned = filtered.slice(0, MAX_NOTE_OVERVIEW_RESULTS);
	const truncated = filtered.length > returned.length;

	return toWorkspaceMcpResult(
		Result.ok({
			ok: true as const,
			freshness: { updatedAt: workspace.updatedAt },
			counts: {
				total: workspace.notes.length,
				matched: filtered.length,
				returned: returned.length,
			},
			parserAvailable: isValidMention !== null,
			diagnostics,
			truncated,
			...(truncated
				? {
						recovery:
							"Narrow notes_overview with noteIds, mentionedTable, mentionedColumn, unresolvedOnly, or textSearch.",
					}
				: {}),
			notes: returned,
		}),
	);
};

export const runNotesApplyChangesTool = async (
	options: {
		readonly context: WorkspaceMcpContext;
		readonly storage: WorkspaceStorage;
		readonly broadcast: (message: ServerMessage) => void;
	},
	input: NotesApplyChangesInput,
) => {
	const ready = await options.context.requireWorkspace({
		requireCanvasPresence: true,
	});
	if (Result.isError(ready)) {
		return options.context.createAvailabilityErrorResult(ready.error);
	}

	const { workspace } = ready.value;
	if (workspace.updatedAt !== input.knownWorkspaceUpdatedAt) {
		return toWorkspaceMcpResult(
			Result.err({
				ok: false as const,
				reason: "stale_workspace_freshness" as const,
				message:
					"The Workspace freshness value is stale; Sticky Notes were not changed.",
				recovery:
					"Call notes_overview to inspect current Sticky Notes and retry notes_apply_changes with the new freshness.",
				currentUpdatedAt: workspace.updatedAt,
				knownWorkspaceUpdatedAt: input.knownWorkspaceUpdatedAt,
			}),
		);
	}

	if (input.operations.length === 0) {
		return toWorkspaceMcpResult(
			Result.err({
				ok: false as const,
				reason: "no_note_operations" as const,
				message: "notes_apply_changes requires at least one note operation.",
				recovery:
					"Provide a bounded list of create, edit_text, replace_text, update_color, or delete operations.",
			}),
		);
	}

	if (input.operations.length > MAX_NOTE_OPERATIONS) {
		return toWorkspaceMcpResult(
			Result.err({
				ok: false as const,
				reason: "too_many_note_operations" as const,
				message: `notes_apply_changes supports at most ${MAX_NOTE_OPERATIONS} operations.`,
				recovery:
					"Split the cleanup into smaller notes_apply_changes calls after rechecking freshness.",
				maxOperations: MAX_NOTE_OPERATIONS,
			}),
		);
	}

	let nextNotes = [...workspace.notes];
	const createdNoteIds: string[] = [];
	const updatedNoteIds = new Set<string>();
	const deletedNoteIds: string[] = [];

	for (const operation of input.operations) {
		if (operation.type === "create") {
			const valid = validateNoteText(operation.text);
			if (Result.isError(valid)) return toWorkspaceMcpResult(Result.err(valid.error));
			const note: SharedStickyNote = {
				id: `sticky-${nanoid(10)}`,
				color: operation.color ?? "yellow",
				text: operation.text,
			};
			nextNotes = [...nextNotes, note];
			createdNoteIds.push(note.id);
			continue;
		}

		const found = findNoteIndex(nextNotes, operation.noteId);
		if (Result.isError(found)) {
			return toWorkspaceMcpResult(Result.err(found.error));
		}
		const index = found.value;
		const note = nextNotes[index];

		if (operation.type === "edit_text") {
			const edited = editNoteText(note, operation);
			if (Result.isError(edited)) {
				return toWorkspaceMcpResult(Result.err(edited.error));
			}
			const valid = validateNoteText(edited.value.text);
			if (Result.isError(valid)) return toWorkspaceMcpResult(Result.err(valid.error));
			nextNotes[index] = edited.value;
			updatedNoteIds.add(operation.noteId);
			continue;
		}

		if (operation.type === "replace_text") {
			const expected = assertExpectedText(note, operation);
			if (Result.isError(expected)) {
				return toWorkspaceMcpResult(Result.err(expected.error));
			}
			const valid = validateNoteText(operation.newText);
			if (Result.isError(valid)) return toWorkspaceMcpResult(Result.err(valid.error));
			nextNotes[index] = { ...note, text: operation.newText };
			updatedNoteIds.add(operation.noteId);
			continue;
		}

		if (operation.type === "update_color") {
			nextNotes[index] = {
				...note,
				color: operation.color,
			};
			updatedNoteIds.add(operation.noteId);
			continue;
		}

		const expected = assertExpectedText(note, operation);
		if (Result.isError(expected)) {
			return toWorkspaceMcpResult(Result.err(expected.error));
		}
		nextNotes = nextNotes.filter((candidate) => candidate.id !== operation.noteId);
		deletedNoteIds.push(operation.noteId);
		updatedNoteIds.delete(operation.noteId);
	}

	await options.storage.saveAgentMutation({ notes: nextNotes });
	const updatedAt = options.storage.cached?.updatedAt ?? workspace.updatedAt;
	options.broadcast({
		type: "state-update",
		patch: { notes: nextNotes, updatedAt },
	});

	return toWorkspaceMcpResult(
		Result.ok({
			ok: true as const,
			freshness: { updatedAt },
			summary: {
				created: createdNoteIds.length,
				updated: updatedNoteIds.size,
				deleted: deletedNoteIds.length,
			},
			createdNoteIds,
			updatedNoteIds: [...updatedNoteIds],
			deletedNoteIds,
		}),
	);
};

export const notesOverviewTool = {
	name: "notes_overview",
	config: {
		description:
			"Returns compact Sticky Note inventory and mention status for durable Diagram notes. Use after schema edits that rename, delete, or supersede Tables or Columns so stale notes can be cleaned up intentionally. Works without Canvas Presence. Use responseFormat: \"detailed\" only for selected notes when preparing exact note edits.",
		inputSchema: {
			noteIds: z
				.array(z.string().min(1))
				.max(MAX_NOTE_OVERVIEW_RESULTS)
				.optional()
				.describe("Optional Sticky Note ids to inspect."),
			mentionedTable: z
				.string()
				.optional()
				.describe("Only return notes containing a #table token for this table."),
			mentionedColumn: z
				.object({ table: z.string(), column: z.string() })
				.optional()
				.describe(
					"Only return notes containing a #table.column token for this table and column.",
				),
			unresolvedOnly: z
				.boolean()
				.optional()
				.describe("Only return notes with unresolved #table or #table.column tokens."),
			textSearch: z
				.string()
				.optional()
				.describe("Case-insensitive text search over Sticky Note bodies."),
			responseFormat: z
				.enum(["concise", "detailed"])
				.optional()
				.describe(
					"Defaults to concise. Use detailed only with selected noteIds to return full note text for exact edits.",
				),
		},
		outputSchema: {
			ok: z.literal(true),
			freshness: z.object({ updatedAt: z.number() }),
			counts: z.object({
				total: z.number().int().nonnegative(),
				matched: z.number().int().nonnegative(),
				returned: z.number().int().nonnegative(),
			}),
			parserAvailable: z.boolean(),
			diagnostics: z.array(z.unknown()),
			truncated: z.boolean(),
			recovery: z.string().optional(),
			notes: z.array(noteSummarySchema),
		},
		annotations: { readOnlyHint: true, openWorldHint: false },
	},
	handler: (context: WorkspaceMcpContext) => (input: unknown) =>
		runNotesOverviewTool(context, input as NotesOverviewInput),
} as const;

const noteCreateOperationSchema = z.object({
	type: z.literal("create"),
	text: z.string().min(1).max(MAX_NOTE_TEXT_LENGTH),
	color: z.enum(stickyNoteColors).optional(),
});

const noteEditTextOperationSchema = z.object({
	type: z.literal("edit_text"),
	noteId: z.string().min(1),
	oldString: z.string().min(1),
	newString: z.string(),
	replaceAll: z.boolean().optional(),
});

const noteReplaceTextOperationSchema = z.object({
	type: z.literal("replace_text"),
	noteId: z.string().min(1),
	expectedText: z.string().optional(),
	expectedTextHash: z.string().optional(),
	newText: z.string().min(1).max(MAX_NOTE_TEXT_LENGTH),
});

const noteUpdateColorOperationSchema = z.object({
	type: z.literal("update_color"),
	noteId: z.string().min(1),
	color: z.enum(stickyNoteColors),
});

const noteDeleteOperationSchema = z.object({
	type: z.literal("delete"),
	noteId: z.string().min(1),
	expectedText: z.string().optional(),
	expectedTextHash: z.string().optional(),
});

export const notesApplyChangesTool = {
	name: "notes_apply_changes",
	config: {
		description:
			"Applies bounded Sticky Note maintenance operations atomically. Use after notes_overview to update or delete stale notes after Schema Editing renames, deletes, or supersedes Tables or Columns. Requires Canvas Presence and current Workspace freshness. Mutates Sticky Note text, color, and existence only; never changes Schema Source, Table Positions, Viewport, Focus, or Selection.",
		inputSchema: {
			knownWorkspaceUpdatedAt: z
				.number()
				.describe("Workspace freshness value from notes_overview."),
			operations: z
				.array(
					z.discriminatedUnion("type", [
						noteCreateOperationSchema,
						noteEditTextOperationSchema,
						noteReplaceTextOperationSchema,
						noteUpdateColorOperationSchema,
						noteDeleteOperationSchema,
					]),
				)
				.min(1)
				.max(MAX_NOTE_OPERATIONS)
				.describe(
					"Bounded note operations. All operations apply atomically or none apply.",
				),
		},
		outputSchema: {
			ok: z.literal(true),
			freshness: z.object({ updatedAt: z.number() }),
			summary: z.object({
				created: z.number().int().nonnegative(),
				updated: z.number().int().nonnegative(),
				deleted: z.number().int().nonnegative(),
			}),
			createdNoteIds: z.array(z.string()),
			updatedNoteIds: z.array(z.string()),
			deletedNoteIds: z.array(z.string()),
		},
		annotations: {
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: false,
			openWorldHint: false,
		},
	},
	handler:
		(options: {
			readonly context: WorkspaceMcpContext;
			readonly storage: WorkspaceStorage;
			readonly broadcast: (message: ServerMessage) => void;
		}) =>
		(input: unknown) =>
			runNotesApplyChangesTool(options, input as NotesApplyChangesInput),
} as const;
