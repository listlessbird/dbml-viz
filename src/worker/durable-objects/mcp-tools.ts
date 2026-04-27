import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { makeSnapshot, type WorkspaceStorage } from "./workspace-storage.ts";
import { MAX_SCHEMA_SOURCE_LENGTH, type ServerMessage } from "./workspace-types.ts";

const STICKY_NOTE_COLORS = ["yellow", "pink", "blue", "green"] as const;
const DEFAULT_STICKY_NOTE = {
	x: 160,
	y: 160,
	width: 220,
	height: 180,
	color: "yellow",
	text: "",
} as const;

export function createWorkspaceMcpServer(
	storage: WorkspaceStorage,
	broadcast: (message: ServerMessage) => void,
): McpServer {
	const server = new McpServer({ name: "dbml-canvas", version: "1.0.0" });

	const requireWorkspace = async () => {
		const workspace = await storage.load();
		if (!workspace) {
			return {
				content: [{ type: "text" as const, text: JSON.stringify({ error: "No active workspace. Ask the user to click 'Connect Canvas' first." }) }],
				isError: true as const,
			};
		}
		await storage.touch();
		return null;
	};

	server.registerTool("get_schema", {
		description: "Returns the current workspace state: DBML/SQL source, positions, notes, and diagnostics.",
		annotations: { readOnlyHint: true },
	}, async () => {
		const err = await requireWorkspace();
		if (err) return err;
		return { content: [{ type: "text", text: JSON.stringify(makeSnapshot(storage.cached!), null, 2) }] };
	});
	// Todo: allow notes to be created in this call
	server.registerTool("set_schema", {
		description: "Replaces the entire DBML/SQL source. The browser parses it — poll get_schema to see diagnostics.",
		inputSchema: { source: z.string().max(MAX_SCHEMA_SOURCE_LENGTH).describe("DBML or SQL DDL source code") },
	}, async ({ source }) => {
		const err = await requireWorkspace();
		if (err) return err;

		await storage.saveAgentMutation({ source });
		broadcast({
			type: "state-update",
			patch: { source, updatedAt: storage.cached!.updatedAt },
		});

		return { content: [{ type: "text", text: JSON.stringify({ ok: true, note: "Source updated. Call get_schema to check for parse errors." }) }] };
	});

	server.registerTool("set_positions", {
		description: "Replaces node positions on the canvas. Keys are table IDs, values are {x, y}.",
		inputSchema: { positions: z.record(z.string(), z.object({ x: z.number(), y: z.number() })).describe("Map of table ID to {x, y}") },
	}, async ({ positions }) => {
		const err = await requireWorkspace();
		if (err) return err;

		await storage.saveAgentMutation({ positions });
		broadcast({
			type: "state-update",
			patch: { positions, updatedAt: storage.cached!.updatedAt },
		});

		return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] };
	});

	server.registerTool("focus_tables", {
		description: "Tells the browser to pan/zoom to specific tables. UX-only, no state change.",
		inputSchema: { tableIds: z.array(z.string()).min(1).describe("Table IDs to focus on") },
		annotations: { readOnlyHint: true },
	}, async ({ tableIds }) => {
		const err = await requireWorkspace();
		if (err) return err;

		broadcast({ type: "focus", tableIds });

		return { content: [{ type: "text", text: JSON.stringify({ ok: true, focused: tableIds }) }] };
	});
	// TODO: allow multiple notes to be created
	server.registerTool("add_sticky_note", {
		description: "Adds a sticky note to the canvas and syncs it to the browser.",
		inputSchema: {
			text: z.string().default(DEFAULT_STICKY_NOTE.text).describe("Sticky note body text"),
			x: z.number().default(DEFAULT_STICKY_NOTE.x).describe("Canvas x coordinate"),
			y: z.number().default(DEFAULT_STICKY_NOTE.y).describe("Canvas y coordinate"),
			width: z.number().positive().default(DEFAULT_STICKY_NOTE.width).describe("Sticky note width"),
			height: z.number().positive().default(DEFAULT_STICKY_NOTE.height).describe("Sticky note height"),
			color: z.enum(STICKY_NOTE_COLORS).default(DEFAULT_STICKY_NOTE.color).describe("Sticky note color"),
		},
	}, async ({ text, x, y, width, height, color }) => {
		const err = await requireWorkspace();
		if (err) return err;

		const workspace = storage.cached!;
		const note = {
			id: `sticky-${crypto.randomUUID()}`,
			x,
			y,
			width,
			height,
			color,
			text,
		};
		const notes = [...workspace.notes, note];

		await storage.saveAgentMutation({ notes });
		broadcast({
			type: "state-update",
			patch: { notes, updatedAt: storage.cached!.updatedAt },
		});

		return { content: [{ type: "text", text: JSON.stringify({ ok: true, note }) }] };
	});

	return server;
}
