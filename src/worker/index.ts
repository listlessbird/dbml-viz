import { getAgentByName, routeAgentRequest } from "agents";

import { app } from "./app";
import { routeWorkspaceAgentRequest } from "./workspace/workspace-routing";

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const workspaceAgentResponse = await routeWorkspaceAgentRequest(request, env, {
			getByName: getAgentByName,
		});
		if (workspaceAgentResponse) return workspaceAgentResponse;

		const agentResponse = await routeAgentRequest(request, env, {
			prefix: "api/agent",
		});
		if (agentResponse) return agentResponse;
		return app.fetch(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;

export type { AppType } from "./app";

export { SchemaWorkspace } from "./workspace/schema-workspace";
