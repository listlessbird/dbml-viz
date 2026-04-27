import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCanvasSession } from "@/hooks/useCanvasSession";
import { useSessionStore } from "@/store/useSessionStore";
import { useStickyNotesStore } from "@/store/useStickyNotesStore";
import type { DiagramRouteState } from "@/lib/draftPersistence";
import type {
	DiagramNode,
	ParsedSchema,
	SchemaPayload,
	SharedStickyNote,
} from "@/types";
import type { ServerSessionMessage } from "@/types/session";

const SOURCE = "Table users {\n  id integer [pk]\n}";
const REMOTE_SOURCE = "Table accounts {\n  id integer [pk]\n}";
const BASELINE_SOURCE = "Table baseline {\n  id integer [pk]\n}";

class MockWebSocket extends EventTarget {
	static instances: MockWebSocket[] = [];
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSING = 2;
	static readonly CLOSED = 3;

	readonly url: string;
	readyState = MockWebSocket.CONNECTING;
	sent: string[] = [];
	closeCalls: Array<{ code?: number; reason?: string }> = [];

	constructor(url: string) {
		super();
		this.url = url;
		MockWebSocket.instances.push(this);
	}

	send(payload: string) {
		this.sent.push(payload);
	}

	close(code?: number, reason?: string) {
		this.readyState = MockWebSocket.CLOSED;
		this.closeCalls.push({ code, reason });
		this.dispatchEvent(new CloseEvent("close"));
	}

	open() {
		this.readyState = MockWebSocket.OPEN;
		this.dispatchEvent(new Event("open"));
	}

	serverMessage(message: ServerSessionMessage) {
		this.dispatchEvent(
			new MessageEvent("message", { data: JSON.stringify(message) }),
		);
	}

	serverClose() {
		this.readyState = MockWebSocket.CLOSED;
		this.dispatchEvent(new CloseEvent("close"));
	}
}

interface HarnessApi {
	readonly connect: () => void;
	readonly share: () => void;
	readonly sourceChange: (source: string) => void;
	readonly disconnect: () => void;
}

interface HarnessProps {
	readonly route?: DiagramRouteState;
	readonly currentShareBaseline?: SchemaPayload | null;
	readonly source?: string;
	readonly isLoadingShare?: boolean;
	readonly onReady: (api: HarnessApi) => void;
	readonly setSource?: (source: string) => void;
	readonly setNodes?: React.Dispatch<React.SetStateAction<DiagramNode[]>>;
	readonly setShareSeedPositions?: (positions: Record<string, { x: number; y: number }>) => void;
	readonly clearDraft?: (shareId: string | null) => void;
	readonly pushViewedRoute?: (route: DiagramRouteState) => void;
	readonly setShareBaseline?: React.Dispatch<
		React.SetStateAction<{ shareId: string; payload: SchemaPayload } | null>
	>;
	readonly setShareLoadError?: (message: string | null) => void;
	readonly requestFitView?: (nodeIds?: readonly string[]) => void;
}

const parsed: ParsedSchema = {
	tables: [
		{
			id: "users",
			name: "users",
			columns: [],
			indexes: [],
		},
	],
	refs: [],
	errors: [],
};

const baselinePayload: SchemaPayload = {
	source: BASELINE_SOURCE,
	positions: { users: { x: 10, y: 20 } },
	notes: [],
	version: 3,
};

function CanvasSessionHarness({
	route = { shareId: null, isDirty: false },
	currentShareBaseline = null,
	source = SOURCE,
	isLoadingShare = false,
	onReady,
	setSource = vi.fn(),
	setNodes = vi.fn(),
	setShareSeedPositions = vi.fn(),
	clearDraft = vi.fn(),
	pushViewedRoute = vi.fn(),
	setShareBaseline = vi.fn(),
	setShareLoadError = vi.fn(),
	requestFitView = vi.fn(),
}: HarnessProps) {
	const session = useCanvasSession({
		source,
		nodes: [
			{
				id: "users",
				type: "table",
				position: { x: 42, y: 84 },
				data: {} as DiagramNode["data"],
			} as DiagramNode,
		],
		parsed,
		diagnostics: [],
		canPersistNodePositions: true,
		shareSeedPositions: { users: { x: 1, y: 2 } },
		isLoadingShare,
		viewedRoute: route,
		currentShareBaseline,
		setSource,
		setNodes,
		setShareSeedPositions,
		clearDraft,
		pushViewedRoute,
		setShareBaseline,
		setShareLoadError,
		requestFitView,
		handleRegularShare: vi.fn(),
	});

	onReady({
		connect: session.handleConnect,
		share: session.handleShare,
		sourceChange: session.handleSourceChange,
		disconnect: session.handleDisconnect,
	});

	return null;
}

const renderHarness = (props: Omit<HarnessProps, "onReady"> = {}) => {
	const apiRef: { current: HarnessApi | null } = { current: null };
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);

	act(() => {
		root.render(
			<CanvasSessionHarness
				{...props}
				onReady={(nextApi) => {
					apiRef.current = nextApi;
				}}
			/>,
		);
	});

	const getApi = () => {
		if (!apiRef.current) throw new Error("Harness API was not initialized.");
		return apiRef.current;
	};
	return { root, container, getApi };
};

let activeRoot: Root | null = null;
let activeContainer: HTMLDivElement | null = null;
let OriginalWebSocket: typeof WebSocket;

beforeEach(() => {
	OriginalWebSocket = globalThis.WebSocket;
	MockWebSocket.instances = [];
	Object.assign(MockWebSocket, {
		CONNECTING: 0,
		OPEN: 1,
		CLOSING: 2,
		CLOSED: 3,
	});
	globalThis.WebSocket = MockWebSocket as unknown as typeof WebSocket;
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: { writeText: vi.fn().mockResolvedValue(undefined) },
	});
});

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
	}

	activeContainer?.remove();
	activeRoot = null;
	activeContainer = null;
	globalThis.WebSocket = OriginalWebSocket;
	useSessionStore.getState().reset();
	vi.useRealTimers();
});

describe("useCanvasSession state machine", () => {
	it("starts a clean shared session with the share baseline and moves connecting to live on ack", () => {
		const rendered = renderHarness({
			route: { shareId: "share-old", isDirty: false },
			currentShareBaseline: baselinePayload,
		});
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		act(() => {
			rendered.getApi().connect();
		});

		const socket = MockWebSocket.instances[0]!;
		expect(useSessionStore.getState().status).toBe("connecting");
		expect(useSessionStore.getState().pairingUrl).toBeNull();
		expect(window.localStorage.getItem("dbml-viz:device-id")).toBe(
			useSessionStore.getState().sessionId,
		);

		act(() => {
			socket.open();
		});

		const attach = JSON.parse(socket.sent[0]!);
		expect(attach).toMatchObject({
			type: "attach",
			state: {
				source: SOURCE,
				positions: { users: { x: 42, y: 84 } },
				baseline: {
					shareId: "share-old",
					source: BASELINE_SOURCE,
				},
			},
		});
		expect(typeof attach.updatedAt).toBe("number");

		act(() => {
			socket.serverMessage({
				type: "state-ack",
				state: {
					source: SOURCE,
					positions: {},
					notes: [],
					diagnostics: [],
					tableCount: 1,
					refCount: 0,
					baseline: { shareId: "share-old" },
				},
			});
		});

		expect(useSessionStore.getState().status).toBe("live");
		expect(useSessionStore.getState().pairingUrl).toContain("/api/agent/");
		expect(useSessionStore.getState().pairingUrl).toContain("/mcp");
	});

	it("locks editor and applies remote source patches without echoing set-source", () => {
		const setSource = vi.fn();
		const rendered = renderHarness({ setSource });
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		act(() => {
			rendered.getApi().connect();
			MockWebSocket.instances[0]!.open();
			MockWebSocket.instances[0]!.serverMessage({
				type: "state-ack",
				state: {
					source: SOURCE,
					positions: {},
					notes: [],
					diagnostics: [],
					tableCount: 1,
					refCount: 0,
					baseline: null,
				},
			});
		});

		const socket = MockWebSocket.instances[0]!;
		socket.sent = [];

		act(() => {
			socket.serverMessage({
				type: "state-update",
				patch: { source: REMOTE_SOURCE },
			});
		});

		expect(setSource).toHaveBeenCalledWith(REMOTE_SOURCE);
		expect(useSessionStore.getState().agentEditorLocked).toBe(true);
		expect(socket.sent).not.toContainEqual(expect.stringContaining("set-source"));
	});

	it("applies remote positions and notes from tool calls", () => {
		const setNodes = vi.fn((updater: React.SetStateAction<DiagramNode[]>) => {
			if (typeof updater === "function") {
				return updater([
					{
						id: "users",
						type: "table",
						position: { x: 0, y: 0 },
						data: {} as DiagramNode["data"],
					} as DiagramNode,
				]);
			}
			return updater;
		});
		const setShareSeedPositions = vi.fn();
		const note: SharedStickyNote = {
			id: "sticky-1",
			x: 10,
			y: 20,
			width: 220,
			height: 180,
			color: "yellow",
			text: "Review users",
		};
		const rendered = renderHarness({ setNodes, setShareSeedPositions });
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		act(() => {
			rendered.getApi().connect();
			MockWebSocket.instances[0]!.open();
			MockWebSocket.instances[0]!.serverMessage({
				type: "state-ack",
				state: {
					source: SOURCE,
					positions: {},
					notes: [],
					diagnostics: [],
					tableCount: 1,
					refCount: 0,
					baseline: null,
				},
			});
			MockWebSocket.instances[0]!.serverMessage({
				type: "state-update",
				patch: {
					positions: { users: { x: 300, y: 400 } },
					notes: [note],
				},
			});
		});

		expect(setShareSeedPositions).toHaveBeenCalledWith({
			users: { x: 300, y: 400 },
		});
		expect(setNodes).toHaveReturnedWith([
			expect.objectContaining({
				id: "users",
				position: { x: 300, y: 400 },
			}),
		]);
		expect(useStickyNotesStore.getState().texts["sticky-1"]).toBe("Review users");
	});

	it("hydrates notes added by the add_sticky_note tool", () => {
		const note: SharedStickyNote = {
			id: "sticky-agent-note",
			x: 120,
			y: 240,
			width: 260,
			height: 160,
			color: "blue",
			text: "Agent note",
		};
		const rendered = renderHarness();
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		act(() => {
			rendered.getApi().connect();
			MockWebSocket.instances[0]!.open();
			MockWebSocket.instances[0]!.serverMessage({
				type: "state-ack",
				state: {
					source: SOURCE,
					positions: {},
					notes: [],
					diagnostics: [],
					tableCount: 1,
					refCount: 0,
					baseline: null,
				},
			});
			MockWebSocket.instances[0]!.serverMessage({
				type: "state-update",
				patch: { notes: [note] },
			});
		});

		expect(useStickyNotesStore.getState().notes).toEqual([
			expect.objectContaining({
				id: "sticky-agent-note",
				position: { x: 120, y: 240 },
				width: 260,
				height: 160,
				color: "blue",
			}),
		]);
		expect(useStickyNotesStore.getState().texts["sticky-agent-note"]).toBe(
			"Agent note",
		);
	});

	it("focuses tables when focus_tables broadcasts a focus message", () => {
		const requestFitView = vi.fn();
		const rendered = renderHarness({ requestFitView });
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		act(() => {
			rendered.getApi().connect();
			MockWebSocket.instances[0]!.open();
			MockWebSocket.instances[0]!.serverMessage({
				type: "state-ack",
				state: {
					source: SOURCE,
					positions: {},
					notes: [],
					diagnostics: [],
					tableCount: 1,
					refCount: 0,
					baseline: null,
				},
			});
			MockWebSocket.instances[0]!.serverMessage({
				type: "focus",
				tableIds: ["users", "accounts"],
			});
		});

		expect(requestFitView).toHaveBeenCalledWith(["users", "accounts"]);
	});

	it("sends local source edits after debounce when live", async () => {
		vi.useFakeTimers();
		const setSource = vi.fn();
		const rendered = renderHarness({ setSource });
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		act(() => {
			rendered.getApi().connect();
			MockWebSocket.instances[0]!.open();
			MockWebSocket.instances[0]!.serverMessage({
				type: "state-ack",
				state: {
					source: SOURCE,
					positions: {},
					notes: [],
					diagnostics: [],
					tableCount: 1,
					refCount: 0,
					baseline: null,
				},
			});
		});

		await act(async () => {
			await Promise.resolve();
		});

		const socket = MockWebSocket.instances[0]!;
		socket.sent = [];

		act(() => {
			rendered.getApi().sourceChange(REMOTE_SOURCE);
			vi.advanceTimersByTime(299);
		});

		expect(setSource).toHaveBeenCalledWith(REMOTE_SOURCE);
		expect(socket.sent.map((payload) => JSON.parse(payload))).not.toContainEqual({
			type: "set-source",
			source: REMOTE_SOURCE,
		});

		act(() => {
			vi.advanceTimersByTime(1);
		});

		expect(socket.sent.map((payload) => JSON.parse(payload))).toContainEqual({
			type: "set-source",
			source: REMOTE_SOURCE,
		});
	});

	it("syncs client parse diagnostics after the session becomes live", () => {
		const rendered = renderHarness();
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		act(() => {
			rendered.getApi().connect();
			MockWebSocket.instances[0]!.open();
			MockWebSocket.instances[0]!.serverMessage({
				type: "state-ack",
				state: {
					source: SOURCE,
					positions: {},
					notes: [],
					diagnostics: [],
					tableCount: 1,
					refCount: 0,
					baseline: null,
				},
			});
		});

		expect(MockWebSocket.instances[0]!.sent.map((payload) => JSON.parse(payload))).toContainEqual({
			type: "set-diagnostics",
			diagnostics: [],
			tableCount: 1,
			refCount: 0,
		});
	});

	it("marks share during session clean and updates the browser baseline", async () => {
		const clearDraft = vi.fn();
		const pushViewedRoute = vi.fn();
		const setShareBaseline = vi.fn();
		const setShareSeedPositions = vi.fn();
		const rendered = renderHarness({
			route: { shareId: "share-old", isDirty: true },
			currentShareBaseline: baselinePayload,
			clearDraft,
			pushViewedRoute,
			setShareBaseline,
			setShareSeedPositions,
		});
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		act(() => {
			rendered.getApi().connect();
			MockWebSocket.instances[0]!.open();
			MockWebSocket.instances[0]!.serverMessage({
				type: "state-ack",
				state: {
					source: SOURCE,
					positions: {},
					notes: [],
					diagnostics: [],
					tableCount: 1,
					refCount: 0,
					baseline: { shareId: "share-old" },
				},
			});
		});

		await act(async () => {
			await Promise.resolve();
		});

		act(() => {
			rendered.getApi().share();
		});

		const socket = MockWebSocket.instances[0]!;
		expect(socket.sent.map((payload) => JSON.parse(payload))).toContainEqual({
			type: "share-request",
		});
		expect(useSessionStore.getState().isSharing).toBe(true);

		act(() => {
			socket.serverMessage({ type: "share-result", id: "share-new" });
		});

		expect(useSessionStore.getState().isSharing).toBe(false);
		expect(clearDraft).toHaveBeenCalledWith("share-old");
		expect(pushViewedRoute).toHaveBeenCalledWith({
			shareId: "share-new",
			isDirty: false,
		});
		expect(setShareSeedPositions).toHaveBeenCalledWith({
			users: { x: 42, y: 84 },
		});
		expect(setShareBaseline).toHaveBeenCalledWith({
			shareId: "share-new",
			payload: {
				source: SOURCE,
				positions: { users: { x: 42, y: 84 } },
				notes: [],
				version: 3,
			},
		});
	});

	it("transitions live to reconnecting on unexpected close and re-attaches on retry", () => {
		vi.useFakeTimers();
		const rendered = renderHarness();
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		act(() => {
			rendered.getApi().connect();
			MockWebSocket.instances[0]!.open();
			MockWebSocket.instances[0]!.serverMessage({
				type: "state-ack",
				state: {
					source: SOURCE,
					positions: {},
					notes: [],
					diagnostics: [],
					tableCount: 1,
					refCount: 0,
					baseline: null,
				},
			});
			MockWebSocket.instances[0]!.serverClose();
		});

		expect(useSessionStore.getState().status).toBe("reconnecting");

		act(() => {
			vi.advanceTimersByTime(1_000);
		});

		const reconnectSocket = MockWebSocket.instances[1]!;
		act(() => {
			reconnectSocket.open();
		});

		const attach = JSON.parse(reconnectSocket.sent[0]!);
		expect(attach).toMatchObject({
			type: "attach",
			state: {
				source: SOURCE,
				positions: { users: { x: 42, y: 84 } },
			},
		});
		expect(typeof attach.updatedAt).toBe("number");
	});
});
