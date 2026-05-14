import { Result } from "better-result";
import { describe, expect, it } from "vitest";

import type {
	ParserClient,
	ParserParseOk,
} from "../../src/worker/lib/parser-client";
import {
	createWorkspaceMcpContext,
	type CanvasPresence,
} from "../../src/worker/workspace/mcp/context";
import {
	runNotesApplyChangesTool,
	runNotesOverviewTool,
} from "../../src/worker/workspace/mcp/tools/note-maintenance";
import type { WorkspaceStorage } from "../../src/worker/workspace/workspace-storage";
import type {
	ServerMessage,
	SharedStickyNote,
	WorkspaceState,
} from "../../src/worker/workspace/workspace-types";

const dbmlSource = [
	"Table users {",
	"  id int [pk]",
	"  email text",
	"}",
].join("\n");

const notes: readonly SharedStickyNote[] = [
	{
		id: "sticky-1",
		color: "yellow",
		text: "Keep #users.email unique. Remove old #accounts note.",
	},
	{
		id: "sticky-2",
		color: "blue",
		text: "General design note.",
	},
];

const baseWorkspace: WorkspaceState = {
	source: dbmlSource,
	positions: { users: { x: 10, y: 20 } },
	notes: [...notes],
	baseline: null,
	createdAt: 100,
	updatedAt: 200,
	lastActivityAt: 200,
};

const presence = (connectionCount: number): CanvasPresence => ({
	connected: connectionCount > 0,
	connectionCount,
});

const parseOk = (): ParserParseOk => ({
	parsed: {
		tables: [
			{
				id: "users",
				name: "users",
				columns: [
					{
						name: "id",
						type: "int",
						pk: true,
						notNull: true,
						unique: true,
						isForeignKey: false,
						isIndexed: true,
					},
					{
						name: "email",
						type: "text",
						pk: false,
						notNull: false,
						unique: false,
						isForeignKey: false,
						isIndexed: false,
					},
				],
				indexes: [],
			},
		],
		refs: [],
		errors: [],
	},
	metadata: { format: "dbml" },
	sourceRanges: null,
});

const stubParserClient = (): ParserClient => ({
	parseSchemaSource: async () => Result.ok(parseOk()),
});

const createStorage = (state: WorkspaceState | null) =>
	({
		load: async () => state,
		touch: async () => {},
		get cached() {
			return state;
		},
	}) as unknown as WorkspaceStorage;

const createMutableStorage = (initial: WorkspaceState | null) => {
	let state = initial
		? { ...initial, positions: { ...initial.positions }, notes: [...initial.notes] }
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
	content: readonly [{ readonly text: string }];
}) => JSON.parse(result.content[0].text) as Record<string, unknown>;

describe("notes_overview", () => {
	it("returns compact Sticky Note summaries with mention status without Canvas Presence", async () => {
		const context = createWorkspaceMcpContext({
			storage: createStorage(baseWorkspace),
			getCanvasPresence: () => presence(0),
			parserClient: stubParserClient(),
		});

		const result = await runNotesOverviewTool(context, {});
		const payload = readPayload(result);

		expect(result.isError).toBeUndefined();
		expect(payload).toMatchObject({
			ok: true,
			freshness: { updatedAt: 200 },
			counts: { total: 2, returned: 2 },
			parserAvailable: true,
			truncated: false,
		});
		expect(payload.notes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					id: "sticky-1",
					color: "yellow",
					textPreview: "Keep #users.email unique. Remove old #accounts note.",
					textLength: notes[0].text.length,
					unresolvedMentionCount: 1,
					mentions: [
						{
							token: "#users.email",
							table: "users",
							column: "email",
							resolved: true,
						},
						{
							token: "#accounts",
							table: "accounts",
							resolved: false,
						},
					],
				}),
			]),
		);
		expect(payload.notes).not.toEqual(
			expect.arrayContaining([expect.objectContaining({ text: notes[0].text })]),
		);
	});

	it("filters notes and returns full text only in detailed mode", async () => {
		const context = createWorkspaceMcpContext({
			storage: createStorage(baseWorkspace),
			getCanvasPresence: () => presence(0),
			parserClient: stubParserClient(),
		});

		const result = await runNotesOverviewTool(context, {
			mentionedTable: "accounts",
			responseFormat: "detailed",
		});
		const payload = readPayload(result);

		expect(result.isError).toBeUndefined();
		expect(payload).toMatchObject({
			ok: true,
			counts: { total: 2, matched: 1, returned: 1 },
			notes: [
				expect.objectContaining({
					id: "sticky-1",
					text: notes[0].text,
				}),
			],
		});
	});
});

describe("notes_apply_changes", () => {
	it("applies mixed Sticky Note changes atomically and mutates only Sticky Notes", async () => {
		const mutable = createMutableStorage(baseWorkspace);
		const broadcasts: ServerMessage[] = [];
		const context = createWorkspaceMcpContext({
			storage: mutable.storage,
			getCanvasPresence: () => presence(1),
			parserClient: stubParserClient(),
		});

		const result = await runNotesApplyChangesTool(
			{
				context,
				storage: mutable.storage,
				broadcast: (message) => broadcasts.push(message),
			},
			{
				knownWorkspaceUpdatedAt: 200,
				operations: [
					{
						type: "edit_text",
						noteId: "sticky-1",
						oldString: "#accounts",
						newString: "#users",
					},
					{
						type: "create",
						text: "New cleanup note for #users",
						color: "green",
					},
					{
						type: "delete",
						noteId: "sticky-2",
						expectedText: "General design note.",
					},
				],
			},
		);
		const payload = readPayload(result);

		expect(result.isError).toBeUndefined();
		expect(mutable.state?.source).toBe(baseWorkspace.source);
		expect(mutable.state?.positions).toEqual(baseWorkspace.positions);
		expect(mutable.state?.notes).toHaveLength(2);
		expect(mutable.state?.notes[0]).toMatchObject({
			id: "sticky-1",
			text: "Keep #users.email unique. Remove old #users note.",
		});
		expect(mutable.state?.notes[1]).toMatchObject({
			text: "New cleanup note for #users",
			color: "green",
		});
		expect(broadcasts).toEqual([
			{
				type: "state-update",
				patch: {
					notes: mutable.state?.notes,
					updatedAt: 300,
				},
			},
		]);
		expect(payload).toMatchObject({
			ok: true,
			freshness: { updatedAt: 300 },
			summary: { created: 1, updated: 1, deleted: 1 },
		});
	});

	it("rejects stale freshness without changing Sticky Notes", async () => {
		const mutable = createMutableStorage(baseWorkspace);
		const broadcasts: ServerMessage[] = [];
		const context = createWorkspaceMcpContext({
			storage: mutable.storage,
			getCanvasPresence: () => presence(1),
			parserClient: stubParserClient(),
		});

		const result = await runNotesApplyChangesTool(
			{
				context,
				storage: mutable.storage,
				broadcast: (message) => broadcasts.push(message),
			},
			{
				knownWorkspaceUpdatedAt: 199,
				operations: [
					{
						type: "edit_text",
						noteId: "sticky-1",
						oldString: "#accounts",
						newString: "#users",
					},
				],
			},
		);
		const payload = readPayload(result);

		expect(result.isError).toBe(true);
		expect(mutable.state?.notes).toEqual(baseWorkspace.notes);
		expect(broadcasts).toEqual([]);
		expect(payload).toMatchObject({
			ok: false,
			reason: "stale_workspace_freshness",
			recovery: expect.stringContaining("notes_overview"),
		});
	});

	it("rejects a missing oldString atomically", async () => {
		const mutable = createMutableStorage(baseWorkspace);
		const broadcasts: ServerMessage[] = [];
		const context = createWorkspaceMcpContext({
			storage: mutable.storage,
			getCanvasPresence: () => presence(1),
			parserClient: stubParserClient(),
		});

		const result = await runNotesApplyChangesTool(
			{
				context,
				storage: mutable.storage,
				broadcast: (message) => broadcasts.push(message),
			},
			{
				knownWorkspaceUpdatedAt: 200,
				operations: [
					{
						type: "create",
						text: "This must not be created",
					},
					{
						type: "edit_text",
						noteId: "sticky-1",
						oldString: "#missing",
						newString: "#users",
					},
				],
			},
		);
		const payload = readPayload(result);

		expect(result.isError).toBe(true);
		expect(mutable.state?.notes).toEqual(baseWorkspace.notes);
		expect(broadcasts).toEqual([]);
		expect(payload).toMatchObject({
			ok: false,
			reason: "old_string_not_found",
			recovery: expect.stringContaining("notes_overview"),
		});
	});
});
