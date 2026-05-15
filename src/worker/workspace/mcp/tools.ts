import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { WorkspaceAgentApi, WorkspaceMcpContext } from "./context.ts";
import { canvasFocusTool } from "./tools/canvas-focus.ts";
import {
	notesApplyChangesTool,
	notesOverviewTool,
} from "./tools/sticky-note.ts";
import { schemaApplyPatchTool } from "./tools/schema-apply-patch.ts";
import { schemaEditTool } from "./tools/schema-edit.ts";
import { schemaOverviewTool } from "./tools/schema-overview.ts";
import { schemaSourceSliceTool } from "./tools/schema-source-slice.ts";
import { workspaceStatusTool } from "./tools/workspace-status.ts";

interface WorkspaceMcpToolRegistrationOptions {
	readonly server: McpServer;
	readonly context: WorkspaceMcpContext;
	readonly agent: WorkspaceAgentApi;
}

export const registerWorkspaceMcpTools = ({
	server,
	context,
	agent,
}: WorkspaceMcpToolRegistrationOptions): void => {
	server.registerTool(
		workspaceStatusTool.name,
		workspaceStatusTool.config,
		workspaceStatusTool.handler(context),
	);
	server.registerTool(
		schemaOverviewTool.name,
		schemaOverviewTool.config,
		schemaOverviewTool.handler(context),
	);
	server.registerTool(
		schemaSourceSliceTool.name,
		schemaSourceSliceTool.config,
		schemaSourceSliceTool.handler(context),
	);
	server.registerTool(
		schemaEditTool.name,
		schemaEditTool.config,
		schemaEditTool.handler({ context, agent }),
	);
	server.registerTool(
		schemaApplyPatchTool.name,
		schemaApplyPatchTool.config,
		schemaApplyPatchTool.handler({ context, agent }),
	);
	server.registerTool(
		notesOverviewTool.name,
		notesOverviewTool.config,
		notesOverviewTool.handler(context),
	);
	server.registerTool(
		notesApplyChangesTool.name,
		notesApplyChangesTool.config,
		notesApplyChangesTool.handler({ context, agent }),
	);
	server.registerTool(
		canvasFocusTool.name,
		canvasFocusTool.config,
		canvasFocusTool.handler({ context, agent }),
	);
};
