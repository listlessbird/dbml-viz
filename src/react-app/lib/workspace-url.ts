export const makeWorkspaceWebSocketUrl = (workspaceId: string): string => {
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	return `${protocol}//${window.location.host}/api/agent/${workspaceId}/ws`;
};

export const makeWorkspaceMcpUrl = (workspaceId: string): string =>
	new URL(`/api/agent/${workspaceId}/mcp`, window.location.origin).toString();
