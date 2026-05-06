import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { WorkspaceStorage } from "../workspace-storage.ts";
import type { ServerMessage } from "../workspace-types.ts";
import type { WorkspaceMcpContext } from "./context.ts";
import { noteCreateTool } from "./tools/note-create.ts";
import { schemaApplyPatchTool } from "./tools/schema-apply-patch.ts";
import { schemaOverviewTool } from "./tools/schema-overview.ts";
import { schemaReplaceSourceTool } from "./tools/schema-replace-source.ts";
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
		schemaApplyPatchTool.name,
		schemaApplyPatchTool.config,
		schemaApplyPatchTool.handler({ context, storage, broadcast }),
	);
	server.registerTool(
		schemaReplaceSourceTool.name,
		schemaReplaceSourceTool.config,
		schemaReplaceSourceTool.handler({ context, storage, broadcast }),
	);
	server.registerTool(
		noteCreateTool.name,
		noteCreateTool.config,
		noteCreateTool.handler({ context, storage, broadcast }),
	);
};
