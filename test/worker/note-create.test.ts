import { describe, expect, it } from "vitest";

import {
	createWorkspaceMcpContext,
	type CanvasPresence,
} from "../../src/worker/workspace/mcp/context";
import {
	runNoteCreateTool,
	type NoteCreateInput,
} from "../../src/worker/workspace/mcp/tools/note-create";
import type { ParserClient } from "../../src/worker/lib/parser-client";
import type { WorkspaceStorage } from "../../src/worker/workspace/workspace-storage";
import type {
	ServerMessage,
	SharedStickyNote,
	WorkspaceState,
} from "../../src/worker/workspace/workspace-types";

const baseSource = [
	"Table users {",
	"  id int [pk]",
	"  email text",
	"}",
].join("\n");

const existingNote: SharedStickyNote = {
	id: "sticky-existing",
	color: "pink",
	text: "earlier",
};

const baseWorkspace: WorkspaceState = {
	source: baseSource,
	positions: { users: { x: 10, y: 20 } },
	notes: [existingNote],
	baseline: null,
	createdAt: 100,
	updatedAt: 200,
	lastActivityAt: 200,
};

const presence = (count: number): CanvasPresence => ({
	connected: count > 0,
	connectionCount: count,
});

const stubParserClient = (): ParserClient => ({
	parseSchemaSource: async () => {
		throw new Error("note_create must not call the Schema Parser Service");
	},
});

const createMutableStorage = (initial: WorkspaceState | null) => {
	let state = initial
		? {
				...initial,
				positions: { ...initial.positions },
				notes: [...initial.notes],
			}
		: null;
	const storage = {
		load: async () => state,
		touch: async () => {},
		saveAgentMutation: async (partial: Partial<WorkspaceState>) => {
			if (!state) return;
			state = {
				...state,
				...partial,
				updatedAt: 300,
				lastActivityAt: 300,
			};
		},
		get cached() {
			return state;
		},
	} as unknown as WorkspaceStorage;

	return {
		storage,
		get state() {
			return state;
		},
	};
};

const readPayload = (result: {
	readonly content: ReadonlyArray<{ readonly text: string }>;
}) => JSON.parse(result.content[0].text) as Record<string, unknown>;

const runTool = async (
	workspace: WorkspaceState | null,
	input: NoteCreateInput,
	canvasConnections = 1,
) => {
	const mutable = createMutableStorage(workspace);
	const broadcasts: ServerMessage[] = [];
	const context = createWorkspaceMcpContext({
		storage: mutable.storage,
		getCanvasPresence: () => presence(canvasConnections),
		parserClient: stubParserClient(),
	});

	const result = await runNoteCreateTool(
		{
			context,
			storage: mutable.storage,
			broadcast: (message) => broadcasts.push(message),
		},
		input,
	);

	return { result, payload: readPayload(result), mutable, broadcasts };
};

describe("note_create", () => {
	it("requires an active durable Workspace", async () => {
		const { result, payload, broadcasts } = await runTool(null, {
			text: "hello",
		});

		expect(result.isError).toBe(true);
		expect(broadcasts).toEqual([]);
		expect(payload).toMatchObject({
			ok: false,
			reason: "workspace_not_active",
		});
	});

	it("requires Canvas Presence before creating a Sticky Note", async () => {
		const { result, payload, mutable, broadcasts } = await runTool(
			baseWorkspace,
			{ text: "hello" },
			0,
		);

		expect(result.isError).toBe(true);
		expect(mutable.state?.notes).toEqual([existingNote]);
		expect(broadcasts).toEqual([]);
		expect(payload).toMatchObject({
			ok: false,
			reason: "canvas_not_connected",
		});
	});

	it("creates a Sticky Note and reports freshness", async () => {
		const { result, payload, mutable, broadcasts } = await runTool(
			baseWorkspace,
			{ text: "consider adding indexes" },
		);

		expect(result.isError).toBeUndefined();
		expect(mutable.state?.notes).toHaveLength(2);
		const created = mutable.state!.notes.at(-1)!;
		expect(created).toMatchObject({
			text: "consider adding indexes",
			color: "yellow",
		});
		expect(typeof created.id).toBe("string");
		expect(created.id.length).toBeGreaterThan(0);
		expect(broadcasts).toEqual([
			{
				type: "state-update",
				patch: {
					notes: mutable.state!.notes,
					updatedAt: 300,
				},
			},
		]);
		expect(payload).toMatchObject({
			ok: true,
			freshness: { updatedAt: 300 },
			note: {
				id: created.id,
				text: "consider adding indexes",
				color: "yellow",
			},
		});
	});

	it("uses explicit color when provided", async () => {
		const { payload, mutable } = await runTool(baseWorkspace, {
			text: "near the users table",
			color: "blue",
		});

		const created = mutable.state!.notes.at(-1)!;
		expect(created).toMatchObject({
			text: "near the users table",
			color: "blue",
		});
		expect(payload).toMatchObject({
			ok: true,
			note: { color: "blue" },
		});
	});

	it("preserves existing Sticky Notes when appending the new one", async () => {
		const { mutable } = await runTool(baseWorkspace, { text: "another" });

		expect(mutable.state?.notes[0]).toEqual(existingNote);
		expect(mutable.state?.notes).toHaveLength(2);
	});

	it("does not change Schema Source, Table Positions, or baseline", async () => {
		const { mutable, broadcasts } = await runTool(baseWorkspace, {
			text: "no source mutation",
		});

		expect(mutable.state?.source).toBe(baseWorkspace.source);
		expect(mutable.state?.positions).toEqual(baseWorkspace.positions);
		expect(mutable.state?.baseline).toEqual(baseWorkspace.baseline);

		const broadcast = broadcasts[0];
		if (broadcast.type !== "state-update") {
			throw new Error("expected state-update broadcast");
		}
		expect(broadcast.patch).not.toHaveProperty("source");
		expect(broadcast.patch).not.toHaveProperty("positions");
	});

	it("keeps `#table` and `#table.column` tokens as plain note text without persisting a secondary link record", async () => {
		const { mutable, payload } = await runTool(baseWorkspace, {
			text: "see #users and #users.email",
		});

		const created = mutable.state!.notes.at(-1)!;
		expect(created.text).toBe("see #users and #users.email");
		expect(created).not.toHaveProperty("links");
		expect(payload.note).not.toHaveProperty("links");
	});

	it("rejects empty note text", async () => {
		const { result, payload, mutable, broadcasts } = await runTool(
			baseWorkspace,
			{ text: "" },
		);

		expect(result.isError).toBe(true);
		expect(mutable.state?.notes).toEqual([existingNote]);
		expect(broadcasts).toEqual([]);
		expect(payload).toMatchObject({
			ok: false,
			reason: "invalid_note_text",
		});
	});
});
