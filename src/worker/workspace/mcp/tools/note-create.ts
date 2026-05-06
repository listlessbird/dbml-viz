import { Result } from "better-result";
import { nanoid } from "nanoid";
import { z } from "zod";

import { toWorkspaceMcpResult } from "../result.ts";
import type { WorkspaceMcpContext } from "../context.ts";
import type { WorkspaceStorage } from "../../workspace-storage.ts";
import type {
	ServerMessage,
	SharedStickyNote,
} from "../../workspace-types.ts";

const STICKY_NOTE_DEFAULT_WIDTH = 220;
const STICKY_NOTE_DEFAULT_HEIGHT = 160;
const MAX_NOTE_TEXT_LENGTH = 4000;

const stickyNoteColors = ["yellow", "pink", "blue", "green"] as const;
type StickyNoteColor = (typeof stickyNoteColors)[number];

export interface NoteCreateInput {
	readonly text: string;
	readonly x?: number;
	readonly y?: number;
	readonly color?: StickyNoteColor;
}

const stickyNoteSchema = z.object({
	id: z.string(),
	x: z.number(),
	y: z.number(),
	width: z.number().positive(),
	height: z.number().positive(),
	color: z.enum(stickyNoteColors),
	text: z.string(),
});

export const runNoteCreateTool = async (
	options: {
		readonly context: WorkspaceMcpContext;
		readonly storage: WorkspaceStorage;
		readonly broadcast: (message: ServerMessage) => void;
	},
	input: NoteCreateInput,
) => {
	const ready = await options.context.requireWorkspace({
		requireCanvasPresence: true,
	});
	if (Result.isError(ready)) {
		return options.context.createAvailabilityErrorResult(ready.error);
	}

	const trimmed = input.text.trim();
	if (trimmed.length === 0) {
		return toWorkspaceMcpResult(
			Result.err({
				ok: false as const,
				reason: "invalid_note_text" as const,
				message: "Sticky Note text must not be empty.",
				recovery:
					"Provide non-empty note text describing the schema reasoning.",
			}),
		);
	}

	if (input.text.length > MAX_NOTE_TEXT_LENGTH) {
		return toWorkspaceMcpResult(
			Result.err({
				ok: false as const,
				reason: "invalid_note_text" as const,
				message: `Sticky Note text exceeds ${MAX_NOTE_TEXT_LENGTH} characters.`,
				recovery:
					"Shorten the note text or split the reasoning across multiple notes.",
			}),
		);
	}

	const { workspace } = ready.value;
	const note: SharedStickyNote = {
		id: `sticky-${nanoid(10)}`,
		x: input.x ?? 0,
		y: input.y ?? 0,
		width: STICKY_NOTE_DEFAULT_WIDTH,
		height: STICKY_NOTE_DEFAULT_HEIGHT,
		color: input.color ?? "yellow",
		text: input.text,
	};

	const nextNotes: readonly SharedStickyNote[] = [...workspace.notes, note];
	await options.storage.saveAgentMutation({ notes: [...nextNotes] });
	const updatedAt = options.storage.cached?.updatedAt ?? workspace.updatedAt;

	options.broadcast({
		type: "state-update",
		patch: { notes: nextNotes, updatedAt },
	});

	return toWorkspaceMcpResult(
		Result.ok({
			ok: true as const,
			freshness: { updatedAt },
			note,
		}),
	);
};

export const noteCreateTool = {
	name: "note_create",
	config: {
		description:
			"Creates a Sticky Note on the Canvas with the given text. Use to leave reasoning, design notes, or pointers next to a schema design. Text supports `#table` and `#table.column` tokens that resolve against the live Parsed Schema at render time; unresolved tokens render as plain text. Requires Canvas Presence. Does not change Schema Source, Table Positions, Viewport, Focus, or Selection. For broad schema edits use schema_apply_patch.",
		inputSchema: {
			text: z
				.string()
				.min(1)
				.max(MAX_NOTE_TEXT_LENGTH)
				.describe(
					"Sticky Note body text. May contain `#table` and `#table.column` tokens.",
				),
			x: z
				.number()
				.optional()
				.describe(
					"Optional Canvas x coordinate. Defaults to a sensible Canvas location when omitted.",
				),
			y: z
				.number()
				.optional()
				.describe(
					"Optional Canvas y coordinate. Defaults to a sensible Canvas location when omitted.",
				),
			color: z
				.enum(stickyNoteColors)
				.optional()
				.describe("Optional Sticky Note color. Defaults to yellow."),
		},
		outputSchema: {
			ok: z.literal(true),
			freshness: z.object({ updatedAt: z.number() }),
			note: stickyNoteSchema,
		},
	},
	handler:
		(options: {
			readonly context: WorkspaceMcpContext;
			readonly storage: WorkspaceStorage;
			readonly broadcast: (message: ServerMessage) => void;
		}) =>
		(input: unknown) =>
			runNoteCreateTool(options, input as NoteCreateInput),
} as const;
