import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ParserClient } from "../../lib/parser-client.ts";
import type { WorkspaceStorage } from "../workspace-storage.ts";
import type { ServerMessage } from "../workspace-types.ts";
import {
	createWorkspaceMcpContext,
	type CanvasPresence,
} from "./context.ts";
import { registerWorkspaceMcpTools } from "./tools.ts";

interface WorkspaceMcpContextOptions {
	readonly storage: WorkspaceStorage;
	readonly getCanvasPresence: () => CanvasPresence;
	readonly parserClient: ParserClient;
}

export interface WorkspaceMcpServerOptions extends WorkspaceMcpContextOptions {
	readonly broadcast: (message: ServerMessage) => void;
}

export function createWorkspaceMcpServer({
	storage,
	getCanvasPresence,
	parserClient,
	broadcast,
}: WorkspaceMcpServerOptions): McpServer {
	const server = new McpServer({ name: "dbml-canvas", version: "0.0.1" });
	const context = createWorkspaceMcpContext({
		storage,
		getCanvasPresence,
		parserClient,
	});

	registerWorkspaceMcpTools({ server, context, storage, broadcast });
	return server;
}
