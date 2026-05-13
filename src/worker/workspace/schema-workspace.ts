import { DurableObject } from "cloudflare:workers";
import { WorkerTransport, type TransportState } from "agents/mcp";
import { log } from "evlog";
import { nanoid } from "nanoid";

import { createParserClient } from "../lib/parser-client.ts";
import type { CanvasPresence } from "./mcp/context.ts";
import { createWorkspaceMcpServer } from "./mcp/server.ts";
import { makeSnapshot, WorkspaceStorage } from "./workspace-storage.ts";
import {
	MAX_SCHEMA_SOURCE_LENGTH,
	WORKSPACE_EVICTION_MS,
	SHARE_TTL_SECONDS,
	type ClientMessage,
	type McpClientInfo,
	type ServerMessage,
} from "./workspace-types.ts";

const MCP_TRANSPORT_STATE_KEY = "mcp:transport-state";

export class SchemaWorkspaceDO extends DurableObject<Env> {
	private store = new WorkspaceStorage(this.ctx.storage);
	private mcpClientInfo: McpClientInfo | null = null;


	private broadcast(message: ServerMessage, exclude?: WebSocket): void {
		const payload = JSON.stringify(message);
		for (const ws of this.ctx.getWebSockets("browser")) {
			if (ws !== exclude) {
				try { ws.send(payload); } catch { /* gone */ }
			}
		}
	}

	private getCanvasPresence(): CanvasPresence {
		const connectionCount = this.ctx.getWebSockets("browser").length;
		return { connected: connectionCount > 0, connectionCount };
	}


	override async alarm(): Promise<void> {
		const workspace = await this.store.load();
		if (!workspace) return;

		const remaining = WORKSPACE_EVICTION_MS - (Date.now() - workspace.lastActivityAt);
		if (remaining > 0) {
			await this.ctx.storage.setAlarm(Date.now() + remaining);
			return;
		}

		await this.store.clear();
	}

	private async scheduleEvictionIfEmpty(): Promise<void> {
		if (this.ctx.getWebSockets("browser").length === 0) {
			await this.ctx.storage.setAlarm(Date.now() + WORKSPACE_EVICTION_MS);
		}
	}


	private handleWebSocketUpgrade(request: Request): Response {
		if (request.headers.get("Upgrade") !== "websocket") {
			return new Response("Expected WebSocket upgrade", { status: 426 });
		}

		const pair = new WebSocketPair();
		this.ctx.acceptWebSocket(pair[1], ["browser"]);
		void this.ctx.storage.deleteAlarm();

		return new Response(null, { status: 101, webSocket: pair[0] });
	}


	override async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
		if (typeof message !== "string") return;

		let msg: ClientMessage;
		try {
			const parsed = JSON.parse(message);
			if (!parsed || typeof parsed !== "object" || !("type" in parsed)) throw 0;
			msg = parsed as ClientMessage;
		} catch {
			ws.send(JSON.stringify({ type: "error", message: "Invalid message" } satisfies ServerMessage));
			return;
		}

		switch (msg.type) {
			case "ping":
				return void ws.send(JSON.stringify({ type: "pong" } satisfies ServerMessage));

			case "attach":
				return void await this.handleAttach(ws, msg);

			case "set-source":
				return void await this.handleSetSource(ws, msg.source);

			case "set-positions":
				return void await this.handlePatch(ws, { positions: msg.positions });

			case "set-notes":
				return void await this.handlePatch(ws, { notes: [...msg.notes] });

			case "share-request":
				return void await this.handleShare(ws);
		}
	}

	override async webSocketClose(ws: WebSocket): Promise<void> {
		ws.close();
		await this.scheduleEvictionIfEmpty();
	}

	override async webSocketError(ws: WebSocket): Promise<void> {
		ws.close();
		await this.scheduleEvictionIfEmpty();
	}


	private async handleAttach(ws: WebSocket, msg: Extract<ClientMessage, { type: "attach" }>): Promise<void> {
		const decision = await this.store.attachBrowser(msg.state, msg.updatedAt);
		if (decision.winner === "remote") {
			ws.send(JSON.stringify({ type: "state-ack", state: makeSnapshot(decision.workspace) } satisfies ServerMessage));
			if (this.mcpClientInfo) {
				ws.send(JSON.stringify({ type: "mcp-client-update", status: "connected", clientInfo: this.mcpClientInfo } satisfies ServerMessage));
			}
			return;
		}

		const nextWorkspace = this.store.cached!;
		ws.send(JSON.stringify({ type: "state-ack", state: makeSnapshot(nextWorkspace) } satisfies ServerMessage));
		if (this.mcpClientInfo) {
			ws.send(JSON.stringify({ type: "mcp-client-update", status: "connected", clientInfo: this.mcpClientInfo } satisfies ServerMessage));
		}
	}

	private async handleSetSource(ws: WebSocket, source: string): Promise<void> {
		if (!(await this.store.load())) return;

		if (source.length > MAX_SCHEMA_SOURCE_LENGTH) {
			ws.send(JSON.stringify({ type: "error", message: `Source exceeds ${MAX_SCHEMA_SOURCE_LENGTH} chars` } satisfies ServerMessage));
			return;
		}

		await this.store.saveBrowserMutation({ source });
		this.broadcast(
			{
				type: "state-update",
				patch: { source, updatedAt: this.store.cached!.updatedAt },
			},
			ws,
		);
	}

	private async handlePatch(ws: WebSocket, partial: Parameters<WorkspaceStorage["saveBrowserMutation"]>[0]): Promise<void> {
		if (!(await this.store.load())) return;
		await this.store.saveBrowserMutation(partial);
		this.broadcast(
			{
				type: "state-update",
				patch: {
					...(partial as Partial<import("./workspace-types.ts").WorkspaceSnapshot>),
					updatedAt: this.store.cached!.updatedAt,
				},
			},
			ws,
		);
	}

	private async handleShare(ws: WebSocket): Promise<void> {
		const workspace = await this.store.load();
		if (!workspace) {
			ws.send(JSON.stringify({ type: "share-error", error: "No active workspace" } satisfies ServerMessage));
			return;
		}

		try {
			const shareId = nanoid(8);
			const payload = { source: workspace.source, positions: workspace.positions, notes: workspace.notes, version: 3 as const };

			await this.env.SCHEMAS.put(shareId, JSON.stringify(payload), { expirationTtl: SHARE_TTL_SECONDS });
			await this.store.saveBrowserMutation({
				baseline: { shareId, source: workspace.source, positions: workspace.positions, notes: workspace.notes },
			});

			ws.send(JSON.stringify({ type: "share-result", id: shareId } satisfies ServerMessage));
			this.broadcast(
				{
					type: "state-update",
					patch: {
						baseline: { shareId },
						updatedAt: this.store.cached!.updatedAt,
					},
				},
				ws,
			);
		} catch (error) {
			log.error({ scope: "workspace_share", op: "save", cause: error });
			ws.send(JSON.stringify({ type: "share-error", error: "Failed to save shared schema" } satisfies ServerMessage));
		}
	}

	private async handleMcpRequest(request: Request): Promise<Response> {
		// A missing Mcp-Session-Id means this is a new initialize request.
		// Clear any persisted transport state so the fresh connection isn't rejected
		// with "Server already initialized" from a previous session.
		if (!request.headers.get("mcp-session-id")) {
			await this.ctx.storage.delete(MCP_TRANSPORT_STATE_KEY);
		}

		const server = createWorkspaceMcpServer({
			storage: this.store,
			getCanvasPresence: () => this.getCanvasPresence(),
			parserClient: createParserClient({
				parserService: this.env.SCHEMA_PARSER,
			}),
			broadcast: (msg) => this.broadcast(msg),
		});
		const transport = new WorkerTransport({
			sessionIdGenerator: () => crypto.randomUUID(),
			storage: {
				// WorkerTransport persists initializeParams here; the session callback
				// below reads them back to tell attached browsers which MCP client arrived.
				get: () => this.ctx.storage.get<TransportState>(MCP_TRANSPORT_STATE_KEY),
				set: (state) => this.ctx.storage.put(MCP_TRANSPORT_STATE_KEY, state),
			},
			onsessioninitialized: () => {
				this.ctx.waitUntil(
					this.ctx.storage
						.get<TransportState>(MCP_TRANSPORT_STATE_KEY)
						.then((state) => {
							const clientInfo = state?.initializeParams?.clientInfo ?? null;
							if (!clientInfo) return;
							if (
								this.mcpClientInfo?.name === clientInfo?.name &&
								this.mcpClientInfo?.title === clientInfo?.title &&
								this.mcpClientInfo?.version === clientInfo?.version
							) {
								return;
							}

							this.mcpClientInfo = clientInfo;
							this.broadcast({
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
						this.broadcast({
							type: "mcp-client-update",
							status: "disconnected",
							clientInfo,
						});
					}),
				);
			},
		});
		await server.connect(transport);
		return transport.handleRequest(request);
	}

	override async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname.endsWith("/ws")) {
			return this.handleWebSocketUpgrade(request);
		}

		if (url.pathname.endsWith("/mcp") || url.pathname.includes("/mcp/")) {
			return this.handleMcpRequest(request);
		}

		return new Response("Not found", { status: 404 });
	}
}
