import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ParserClient } from "../../lib/parser-client.ts";
import {
	createWorkspaceMcpContext,
	type WorkspaceAgentApi,
} from "./context.ts";
import { registerWorkspaceMcpTools } from "./tools.ts";

export interface WorkspaceMcpServerOptions {
	readonly agent: WorkspaceAgentApi;
	readonly parserClient: ParserClient;
}

export function createWorkspaceMcpServer({
	agent,
	parserClient,
}: WorkspaceMcpServerOptions): McpServer {
	const server = new McpServer({ name: "dbml-canvas", version: "0.0.1" });
	const context = createWorkspaceMcpContext({ agent, parserClient });

	registerWorkspaceMcpTools({ server, context, agent });
	return server;
}
