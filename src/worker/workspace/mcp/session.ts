import type { TransportState } from "agents/mcp";

import type { McpClientInfo } from "../workspace-types.ts";

export const MCP_TRANSPORT_STATE_KEY = "mcp:transport-state";
export const MCP_SESSION_TERMINATED_KEY = "mcp:terminated-session-id";

interface McpSessionStorage {
	get<T>(key: string): Promise<T | undefined>;
	put(entries: Record<string, unknown>): Promise<void>;
	delete(key: string): Promise<unknown>;
}

type WorkspaceMcpTransportState = TransportState & {
	readonly initializeParams?: {
		readonly clientInfo?: McpClientInfo;
	};
};

interface TrackedMcpTransport {
	close(): Promise<void> | void;
	onclose?: (() => void) | undefined;
}

export class WorkspaceMcpSession {
	private readonly activeTransports = new Set<TrackedMcpTransport>();

	constructor(private readonly storage: McpSessionStorage) {}

	transportStorage() {
		return {
			get: () =>
				this.storage.get<WorkspaceMcpTransportState>(MCP_TRANSPORT_STATE_KEY),
			set: (state: WorkspaceMcpTransportState) =>
				this.storage.put({ [MCP_TRANSPORT_STATE_KEY]: state }),
		};
	}

	loadTransportState(): Promise<WorkspaceMcpTransportState | undefined> {
		return this.storage.get<WorkspaceMcpTransportState>(MCP_TRANSPORT_STATE_KEY);
	}

	async prepareRequest(request: Request): Promise<Response | null> {
		const rejected = await this.rejectTerminatedRequest(request);
		if (rejected) return rejected;

		if (!request.headers.get("mcp-session-id")) {
			await this.storage.delete(MCP_TRANSPORT_STATE_KEY);
		}

		return null;
	}

	async rejectTerminatedRequest(request: Request): Promise<Response | null> {
		const sessionId = request.headers.get("mcp-session-id");
		if (!sessionId) return null;

		const terminatedSessionId = await this.storage.get<string>(
			MCP_SESSION_TERMINATED_KEY,
		);
		if (terminatedSessionId !== sessionId) return null;

		return new Response(
			JSON.stringify({
				jsonrpc: "2.0",
				error: { code: -32001, message: "Session not found" },
				id: null,
			}),
			{
				status: 404,
				headers: { "Content-Type": "application/json" },
			},
		);
	}

	trackTransport(transport: TrackedMcpTransport): void {
		this.activeTransports.add(transport);
		const originalOnClose = transport.onclose;
		transport.onclose = () => {
			this.activeTransports.delete(transport);
			originalOnClose?.();
		};
	}

	untrackTransport(transport: TrackedMcpTransport): void {
		this.activeTransports.delete(transport);
	}

	async terminateActiveSession(): Promise<{
		readonly sessionId: string | null;
		readonly clientInfo: McpClientInfo | null;
	}> {
		const state = await this.storage.get<WorkspaceMcpTransportState>(
			MCP_TRANSPORT_STATE_KEY,
		);
		const sessionId = state?.sessionId ?? null;
		const clientInfo = state?.initializeParams?.clientInfo ?? null;

		await Promise.all([
			this.storage.delete(MCP_TRANSPORT_STATE_KEY),
			sessionId
				? this.storage.put({ [MCP_SESSION_TERMINATED_KEY]: sessionId })
				: Promise.resolve(),
			...Array.from(this.activeTransports, (transport) =>
				Promise.resolve(transport.close()),
			),
		]);
		this.activeTransports.clear();

		return { sessionId, clientInfo };
	}
}
