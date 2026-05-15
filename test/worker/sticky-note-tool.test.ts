import { describe, expect, it } from "vitest";
import { Result } from "better-result";

import {
	createWorkspaceMcpContext,
	type CanvasPresence,
	type WorkspaceAgentApi,
} from "../../src/worker/workspace/mcp/context";
import {
	runNotesApplyChangesTool,
	runNotesOverviewTool,
	type NotesApplyChangesInput,
	type NotesOverviewInput,
} from "../../src/worker/workspace/mcp/tools/sticky-note";
import type {
	ParserClient,
	ParserParseOk,
} from "../../src/worker/lib/parser-client";
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
	updatedAt: 200,
};

const presence = (count: number): CanvasPresence => ({
	connected: count > 0,
	connectionCount: count,
});

const parseOk = (): ParserParseOk => ({
	parsed: {
		tables: [
			{
				id: "users",
				name: "users",
				columns: [
					{ name: "id", type: "int", pk: true, notNull: true, unique: true, isForeignKey: false, isIndexed: true },
					{ name: "email", type: "text", pk: false, notNull: false, unique: false, isForeignKey: false, isIndexed: false },
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

const stubParser = (
	respond: () => ReturnType<ParserClient["parseSchemaSource"]> = async () =>
		Result.ok(parseOk()),
): ParserClient => ({
	parseSchemaSource: respond,
});

interface AgentFake {
	readonly api: WorkspaceAgentApi;
	readonly broadcasts: ServerMessage[];
	readonly state: () => WorkspaceState | null;
}

const createAgentFake = (
	initial: WorkspaceState | null,
	canvasConnections: number,
): AgentFake => {
	let state = initial ? { ...initial, notes: [...initial.notes] } : null;
	const broadcasts: ServerMessage[] = [];
	const api: WorkspaceAgentApi = {
		get state() {
			return state;
		},
		get canvasPresence() {
			return presence(canvasConnections);
		},
		mutate(partial) {
			if (!state) return;
			state = { ...state, ...partial, updatedAt: 300 };
		},
		broadcast(message) {
			broadcasts.push(message);
		},
	};
	return { api, broadcasts, state: () => state };
};

const readPayload = (result: { content: readonly [{ readonly text: string }] }) =>
	JSON.parse(result.content[0].text) as Record<string, unknown>;

const runOverview = async (
	state: WorkspaceState | null,
	input: NotesOverviewInput = {},
) => {
	const fake = createAgentFake(state, 1);
	const context = createWorkspaceMcpContext({
		agent: fake.api,
		parserClient: stubParser(),
	});
	const result = await runNotesOverviewTool(context, input);
	return { result, payload: readPayload(result), fake };
};

const runApply = async (
	state: WorkspaceState | null,
	input: NotesApplyChangesInput,
	canvasConnections = 1,
) => {
	const fake = createAgentFake(state, canvasConnections);
	const context = createWorkspaceMcpContext({
		agent: fake.api,
		parserClient: stubParser(),
	});
	const result = await runNotesApplyChangesTool(
		{ context, agent: fake.api },
		input,
	);
	return { result, payload: readPayload(result), fake };
};

describe("notes_overview", () => {
	it("returns concise summaries with mention resolution", async () => {
		const { result, payload } = await runOverview(baseWorkspace);

		expect(result.isError).toBeUndefined();
		expect(payload).toMatchObject({
			ok: true,
			freshness: { updatedAt: 200 },
			counts: { total: 2, matched: 2, returned: 2 },
			parserAvailable: true,
			truncated: false,
		});
		const summaries = payload.notes as Array<{
			readonly id: string;
			readonly mentions: ReadonlyArray<{ readonly resolved: boolean | null }>;
			readonly unresolvedMentionCount: number;
		}>;
		const sticky1 = summaries.find((s) => s.id === "sticky-1")!;
		expect(sticky1.mentions).toHaveLength(2);
		expect(sticky1.unresolvedMentionCount).toBe(1);
	});

	it("filters by unresolvedOnly when the parser succeeds", async () => {
		const { payload } = await runOverview(baseWorkspace, {
			unresolvedOnly: true,
		});

		const summaries = payload.notes as Array<{ readonly id: string }>;
		expect(summaries).toHaveLength(1);
		expect(summaries[0]!.id).toBe("sticky-1");
	});

	it("requires an active Workspace", async () => {
		const { result, payload } = await runOverview(null);
		expect(result.isError).toBe(true);
		expect(payload).toMatchObject({
			ok: false,
			reason: "workspace_not_active",
		});
	});
});

describe("notes_apply_changes", () => {
	it("creates a new note via mutate and stamps the freshness", async () => {
		const { result, payload, fake } = await runApply(baseWorkspace, {
			knownWorkspaceUpdatedAt: 200,
			operations: [{ type: "create", text: "new design note", color: "pink" }],
		});

		expect(result.isError).toBeUndefined();
		expect(payload).toMatchObject({
			ok: true,
			freshness: { updatedAt: 300 },
			summary: { created: 1, updated: 0, deleted: 0 },
		});
		expect(fake.state()?.notes).toHaveLength(3);
		expect(fake.state()?.notes[2]?.text).toBe("new design note");
		expect(fake.state()?.notes[2]?.color).toBe("pink");
		expect(fake.broadcasts).toEqual([]);
	});

	it("requires Canvas Presence", async () => {
		const { result, payload, fake } = await runApply(
			baseWorkspace,
			{
				knownWorkspaceUpdatedAt: 200,
				operations: [{ type: "create", text: "x" }],
			},
			0,
		);
		expect(result.isError).toBe(true);
		expect(payload).toMatchObject({
			ok: false,
			reason: "canvas_not_connected",
		});
		expect(fake.state()?.notes).toHaveLength(2);
	});

	it("rejects stale freshness", async () => {
		const { result, payload, fake } = await runApply(baseWorkspace, {
			knownWorkspaceUpdatedAt: 199,
			operations: [{ type: "create", text: "x" }],
		});
		expect(result.isError).toBe(true);
		expect(payload).toMatchObject({
			ok: false,
			reason: "stale_workspace_freshness",
		});
		expect(fake.state()?.notes).toHaveLength(2);
	});

	it("edits an existing note with exact replacement", async () => {
		const { result, payload, fake } = await runApply(baseWorkspace, {
			knownWorkspaceUpdatedAt: 200,
			operations: [
				{
					type: "edit_text",
					noteId: "sticky-2",
					oldString: "General design note.",
					newString: "Refined design note.",
				},
			],
		});

		expect(result.isError).toBeUndefined();
		expect(payload).toMatchObject({
			ok: true,
			summary: { created: 0, updated: 1, deleted: 0 },
		});
		const edited = fake.state()?.notes.find((n) => n.id === "sticky-2");
		expect(edited?.text).toBe("Refined design note.");
	});

	it("deletes a note when expectedText matches", async () => {
		const { result, payload, fake } = await runApply(baseWorkspace, {
			knownWorkspaceUpdatedAt: 200,
			operations: [
				{
					type: "delete",
					noteId: "sticky-2",
					expectedText: "General design note.",
				},
			],
		});

		expect(result.isError).toBeUndefined();
		expect(payload).toMatchObject({
			ok: true,
			summary: { created: 0, updated: 0, deleted: 1 },
		});
		expect(fake.state()?.notes).toHaveLength(1);
		expect(fake.state()?.notes[0]?.id).toBe("sticky-1");
	});

	it("rejects delete when expectedText drifted", async () => {
		const { result, payload, fake } = await runApply(baseWorkspace, {
			knownWorkspaceUpdatedAt: 200,
			operations: [
				{
					type: "delete",
					noteId: "sticky-2",
					expectedText: "stale text",
				},
			],
		});
		expect(result.isError).toBe(true);
		expect(payload).toMatchObject({
			ok: false,
			reason: "expected_note_text_mismatch",
		});
		expect(fake.state()?.notes).toHaveLength(2);
	});
});
