interface WorkspaceAgentStub {
	readonly fetch: (request: Request) => Response | Promise<Response>;
}

interface WorkspaceAgentRouterDeps {
	readonly getByName: (
		namespace: Env["SchemaWorkspace"],
		name: string,
	) => WorkspaceAgentStub | Promise<WorkspaceAgentStub>;
}

export interface WorkspaceAgentRouteMatch {
	readonly workspaceId: string;
}

const WORKSPACE_AGENT_PREFIX = ["api", "agent", "schema-workspace"] as const;

export const matchWorkspaceAgentRoute = (
	request: Request,
): WorkspaceAgentRouteMatch | null => {
	const parts = new URL(request.url).pathname.split("/").filter(Boolean);

	for (const [index, part] of WORKSPACE_AGENT_PREFIX.entries()) {
		if (parts[index] !== part) return null;
	}

	const workspaceId = parts[WORKSPACE_AGENT_PREFIX.length];
	if (!workspaceId) return null;

	return { workspaceId };
};

export const routeWorkspaceAgentRequest = async (
	request: Request,
	env: Env,
	deps: WorkspaceAgentRouterDeps,
): Promise<Response | null> => {
	const match = matchWorkspaceAgentRoute(request);
	if (!match) return null;

	const agent = await deps.getByName(env.SchemaWorkspace, match.workspaceId);
	return agent.fetch(request);
};
