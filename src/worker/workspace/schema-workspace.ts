import { Agent, type Connection, type WSMessage } from "agents";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createMcpHandler, WorkerTransport } from "agents/mcp";
import { Result, TaggedError } from "better-result";

import { createParserClient } from "../lib/parser-client.ts";
import type { CanvasPresence, WorkspaceAgentApi } from "./mcp/context.ts";
import { createWorkspaceMcpServer } from "./mcp/server.ts";
import { WorkspaceMcpSession } from "./mcp/session.ts";
import { decideWorkspaceAttach } from "./workspace-attach.ts";
import {
	WORKSPACE_EVICTION_MS,
	type ClientMessage,
	type McpClientInfo,
	type ServerMessage,
	type WorkspaceState,
} from "./workspace-types.ts";

class InvalidClientMessageError extends TaggedError("InvalidClientMessageError")<{
	readonly message: string;
}>() {
	constructor() {
		super({ message: "Invalid message" });
	}
}

const parseClientMessage = (
	raw: string,
): Result<ClientMessage, InvalidClientMessageError> =>
	Result.try({
		try: () => {
			const parsed: unknown = JSON.parse(raw);
			if (!parsed || typeof parsed !== "object" || !("type" in parsed)) {
				throw new InvalidClientMessageError();
			}
			return parsed as ClientMessage;
		},
		catch: (cause) =>
			cause instanceof InvalidClientMessageError
				? cause
				: new InvalidClientMessageError(),
	});

const EVICT_CALLBACK = "evict";

export class SchemaWorkspace extends Agent<Env, WorkspaceState | null> {
	override initialState = null as WorkspaceState | null;

	private mcpSession!: WorkspaceMcpSession;
	private mcpServer!: McpServer;
	private mcpTransport!: WorkerTransport;
	private mcpClientInfo: McpClientInfo | null = null;

	private buildAgentApi(): WorkspaceAgentApi {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const agent = this;
		return {
			get state() {
				return agent.state;
			},
			get canvasPresence() {
				return agent.getCanvasPresence();
			},
			mutate: (partial) => agent.applyMutation(partial),
			broadcast: (message) => agent.broadcastServerMessage(message),
		};
	}

	override async onStart(): Promise<void> {
		this.mcpSession = new WorkspaceMcpSession(this.ctx.storage);

		this.mcpTransport = new WorkerTransport({
			sessionIdGenerator: () => crypto.randomUUID(),
			storage: this.mcpSession.transportStorage(),
			onsessioninitialized: () => {
				this.ctx.waitUntil(
					this.mcpSession.loadTransportState().then((state) => {
						const clientInfo = state?.initializeParams?.clientInfo ?? null;
						if (!clientInfo) return;
						if (
							this.mcpClientInfo?.name === clientInfo.name &&
							this.mcpClientInfo?.title === clientInfo.title &&
							this.mcpClientInfo?.version === clientInfo.version
						) {
							return;
						}
						this.mcpClientInfo = clientInfo;
						this.broadcastServerMessage({
							type: "mcp-client-update",
							status: "connected",
							clientInfo,
						});
					}),
				);
			},
			onsessionclosed: () => {
				this.ctx.waitUntil(
					Promise.resolve().then(() => {
						const clientInfo = this.mcpClientInfo;
						if (clientInfo === null) return;
						this.mcpClientInfo = null;
						this.broadcastServerMessage({
							type: "mcp-client-update",
							status: "disconnected",
							clientInfo,
						});
					}),
				);
			},
		});

		this.mcpSession.trackTransport(this.mcpTransport);

		this.mcpServer = createWorkspaceMcpServer({
			agent: this.buildAgentApi(),
			parserClient: createParserClient({ parserService: this.env.SCHEMA_PARSER }),
		});
	}

	override async onConnect(): Promise<void> {
		const schedules = await this.listSchedules();
		for (const schedule of schedules) {
			if (schedule.callback === EVICT_CALLBACK) {
				await this.cancelSchedule(schedule.id);
			}
		}

		if (this.mcpClientInfo) {
			this.broadcastServerMessage({
				type: "mcp-client-update",
				status: "connected",
				clientInfo: this.mcpClientInfo,
			});
		}
	}

	override async onMessage(connection: Connection, raw: WSMessage): Promise<void> {
		if (typeof raw !== "string") return;

		const parsed = parseClientMessage(raw);
		if (Result.isError(parsed)) {
			connection.send(
				JSON.stringify({
					type: "error",
					message: parsed.error.message,
				} satisfies ServerMessage),
			);
			return;
		}

		const msg = parsed.value;
		switch (msg.type) {
			case "ping":
				connection.send(JSON.stringify({ type: "pong" } satisfies ServerMessage));
				return;
			case "attach":
				await this.handleAttach(msg);
				return;
			case "end-workspace":
				await this.handleEndWorkspace();
				return;
		}
	}

	override async onClose(): Promise<void> {
		if (Array.from(this.getConnections()).length === 0) {
			await this.schedule(WORKSPACE_EVICTION_MS / 1000, EVICT_CALLBACK);
		}
	}

	async evict(): Promise<void> {
		const clientInfo = this.mcpClientInfo;
		this.mcpClientInfo = null;
		this.setState(null);
		await this.mcpSession.terminateActiveSession();
		if (clientInfo) {
			this.broadcastServerMessage({
				type: "mcp-client-update",
				status: "disconnected",
				clientInfo,
			});
		}
		this.broadcastServerMessage({ type: "workspace-ended" });
	}

	override async onRequest(request: Request): Promise<Response> {
		const rejected = await this.mcpSession.prepareRequest(request);
		if (rejected) return rejected;

		const url = new URL(request.url);
		const handler = createMcpHandler(this.mcpServer, {
			route: url.pathname,
			transport: this.mcpTransport,
		});
		return handler(request, this.env, this.ctx as unknown as ExecutionContext);
	}

	private async handleAttach(msg: Extract<ClientMessage, { type: "attach" }>): Promise<void> {
		const seed = msg.state;
		const decision = decideWorkspaceAttach(this.state, {
			state: seed,
			updatedAt: msg.updatedAt,
		});

		if (decision.winner === "browser") {
			this.setState({
				source: decision.state.source,
				positions: decision.state.positions,
				notes: [...decision.state.notes],
				baseline: decision.state.baseline
					? { shareId: decision.state.baseline.shareId }
					: null,
				updatedAt: decision.updatedAt,
			});
		}
	}

	private async handleEndWorkspace(): Promise<void> {
		const terminated = await this.mcpSession.terminateActiveSession();
		const clientInfo = this.mcpClientInfo ?? terminated.clientInfo;
		this.mcpClientInfo = null;

		this.setState(null);

		if (clientInfo) {
			this.broadcastServerMessage({
				type: "mcp-client-update",
				status: "disconnected",
				clientInfo,
			});
		}
		this.broadcastServerMessage({ type: "workspace-ended" });
	}

	private applyMutation(partial: Partial<WorkspaceState>): void {
		const current = this.state;
		if (!current) return;
		this.setState({
			...current,
			...partial,
			updatedAt: Date.now(),
		});
	}

	private getCanvasPresence(): CanvasPresence {
		const connectionCount = Array.from(this.getConnections()).length;
		return { connected: connectionCount > 0, connectionCount };
	}

	private broadcastServerMessage(message: ServerMessage): void {
		this.broadcast(JSON.stringify(message));
	}
}

