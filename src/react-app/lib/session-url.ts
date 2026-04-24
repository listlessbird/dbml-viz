export const makeSessionWebSocketUrl = (sessionId: string): string => {
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	return `${protocol}//${window.location.host}/api/session/${sessionId}/ws`;
};

export const makeSessionMcpUrl = (sessionId: string): string =>
	new URL(`/api/session/${sessionId}/mcp`, window.location.origin).toString();
