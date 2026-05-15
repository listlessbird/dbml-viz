export const makeWorkspaceWebSocketUrl = (workspaceId: string): string => {
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	return `${protocol}//${window.location.host}/api/agent/schema-workspace/${workspaceId}/ws`;
};

export const makeWorkspaceMcpUrl = (workspaceId: string): string =>
	new URL(
		`/api/agent/schema-workspace/${workspaceId}/mcp`,
		window.location.origin,
	).toString();
