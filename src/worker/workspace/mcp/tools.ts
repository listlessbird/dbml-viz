import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { WorkspaceStorage } from "../workspace-storage.ts";
import type { ServerMessage } from "../workspace-types.ts";
import type { WorkspaceMcpContext } from "./context.ts";
import { canvasFocusTool } from "./tools/canvas-focus.ts";
import { noteCreateTool } from "./tools/note-create.ts";
import {
	notesApplyChangesTool,
	notesOverviewTool,
} from "./tools/note-maintenance.ts";
import { schemaApplyPatchTool } from "./tools/schema-apply-patch.ts";
import { schemaEditTool } from "./tools/schema-edit.ts";
import { schemaOverviewTool } from "./tools/schema-overview.ts";
import { schemaSourceSliceTool } from "./tools/schema-source-slice.ts";
import { workspaceStatusTool } from "./tools/workspace-status.ts";

interface WorkspaceMcpToolRegistrationOptions {
	readonly server: McpServer;
	readonly context: WorkspaceMcpContext;
	readonly storage: WorkspaceStorage;
	readonly broadcast: (message: ServerMessage) => void;
}

export const registerWorkspaceMcpTools = ({
	server,
	context,
	storage,
	broadcast,
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
		schemaEditTool.handler({ context, storage, broadcast }),
	);
	server.registerTool(
		schemaApplyPatchTool.name,
		schemaApplyPatchTool.config,
		schemaApplyPatchTool.handler({ context, storage, broadcast }),
	);
	server.registerTool(
		noteCreateTool.name,
		noteCreateTool.config,
		noteCreateTool.handler({ context, storage, broadcast }),
	);
	server.registerTool(
		notesOverviewTool.name,
		notesOverviewTool.config,
		notesOverviewTool.handler(context),
	);
	server.registerTool(
		notesApplyChangesTool.name,
		notesApplyChangesTool.config,
		notesApplyChangesTool.handler({ context, storage, broadcast }),
	);
	server.registerTool(
		canvasFocusTool.name,
		canvasFocusTool.config,
		canvasFocusTool.handler({ context, broadcast }),
	);
};
