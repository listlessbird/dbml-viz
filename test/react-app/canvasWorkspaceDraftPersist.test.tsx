import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCanvasWorkspace } from "@/hooks/useCanvasWorkspace";
import { useDraftPersistence } from "@/hooks/useDraftPersistence";
import { useDiagramDraftStore } from "@/store/useDiagramDraftStore";
import { useWorkspaceMetaStore } from "@/store/useWorkspaceMetaStore";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { getInitialDraftState, type DiagramRouteState } from "@/lib/draftPersistence";
import type {
	DiagramNode,
	ParsedSchema,
	SchemaPayload,
} from "@/types";
import type { ServerWorkspaceMessage } from "@/types/workspace";

const OLD_SOURCE = "Table old_pre_mcp {\n  id integer [pk]\n}";
const MCP_SOURCE = "Table mcp_written {\n  id integer [pk]\n}";

class MockWebSocket extends EventTarget {
	static instances: MockWebSocket[] = [];
	static readonly CONNECTING = 0;
	static readonly OPEN = 1;
	static readonly CLOSING = 2;
	static readonly CLOSED = 3;

	readonly url: string;
	readyState = MockWebSocket.CONNECTING;
	sent: string[] = [];

	constructor(url: string) {
		super();
		this.url = url;
		MockWebSocket.instances.push(this);
	}

	send(payload: string) {
		this.sent.push(payload);
	}

	close() {
		this.readyState = MockWebSocket.CLOSED;
		this.dispatchEvent(new CloseEvent("close"));
	}

	open() {
		this.readyState = MockWebSocket.OPEN;
		this.dispatchEvent(new Event("open"));
	}

	serverMessage(message: ServerWorkspaceMessage) {
		this.dispatchEvent(
			new MessageEvent("message", { data: JSON.stringify(message) }),
		);
	}
}

const parsed: ParsedSchema = {
	tables: [],
	refs: [],
	errors: [],
};

interface HarnessApi {
	readonly connect: () => void;
	readonly setSourceFromUser: (source: string) => void;
}

interface HarnessProps {
	readonly initialSource: string;
	readonly onReady: (api: HarnessApi) => void;
}

function Harness({ initialSource, onReady }: HarnessProps) {
	const route: DiagramRouteState = { shareId: null, isDirty: false };
	const [source, setSource] = (
		require("react") as typeof import("react")
	).useState<string>(initialSource);
	const setDraft = useDiagramDraftStore((s) => s.setDraft);
	const clearDraft = useDiagramDraftStore((s) => s.clearDraft);

	const workspace = useCanvasWorkspace({
		source,
		nodes: [] as DiagramNode[],
		parsed,
		diagnostics: [],
		canPersistNodePositions: false,
		shareSeedPositions: {},
		isLoadingShare: false,
		viewedRoute: route,
		currentShareBaseline: null,
		setSource,
		setNodes: vi.fn(),
		setShareSeedPositions: vi.fn(),
		clearDraft,
		pushViewedRoute: vi.fn(),
		setShareBaseline: vi.fn(),
		setShareLoadError: vi.fn(),
		requestFitView: vi.fn(),
		handleRegularShare: vi.fn(),
	});

	useDraftPersistence({
		source,
		nodes: [] as DiagramNode[],
		canPersistNodePositions: false,
		shareSeedPositions: {},
		isLoadingShare: false,
		workspaceStatus: workspace.status,
		viewedRoute: route,
		currentShareBaseline: null,
		rootSampleBaseline: null,
		clearDraft,
		setDraft,
		replaceViewedRoute: vi.fn(),
	});

	onReady({
		connect: workspace.handleConnect,
		setSourceFromUser: workspace.handleSourceChange,
	});

	return null;
}

const renderHarness = (initialSource: string) => {
	const apiRef: { current: HarnessApi | null } = { current: null };
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);

	act(() => {
		root.render(
			<Harness
				initialSource={initialSource}
				onReady={(api) => {
					apiRef.current = api;
				}}
			/>,
		);
	});

	return {
		root,
		container,
		getApi: () => {
			if (!apiRef.current) throw new Error("api not ready");
			return apiRef.current;
		},
	};
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
	window.localStorage.clear();
	useDiagramDraftStore.setState({ drafts: {} });
	useWorkspaceMetaStore.setState({ lastServerUpdatedAt: null });
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
	useWorkspaceStore.getState().reset();
	useWorkspaceMetaStore.setState({ lastServerUpdatedAt: null });
	useDiagramDraftStore.setState({ drafts: {} });
	window.localStorage.clear();
	vi.useRealTimers();
});

describe("draft persistence during live MCP session", () => {
	it("persists the MCP-pushed source to localStorage so a refresh sees it", () => {
		vi.useFakeTimers();

		const rendered = renderHarness(OLD_SOURCE);
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		act(() => {
			rendered.getApi().connect();
			MockWebSocket.instances[0]!.open();
			MockWebSocket.instances[0]!.serverMessage({
				type: "state-ack",
				state: {
					source: OLD_SOURCE,
					positions: {},
					notes: [],
					diagnostics: [],
					tableCount: 0,
					refCount: 0,
					baseline: null,
					updatedAt: 1_700_000_000_000,
				},
			});
		});

		expect(useWorkspaceStore.getState().status).toBe("live");

		act(() => {
			MockWebSocket.instances[0]!.serverMessage({
				type: "state-update",
				patch: { source: MCP_SOURCE, updatedAt: 1_700_000_001_000 },
			});
		});

		act(() => {
			vi.advanceTimersByTime(500);
		});

		const persisted = useDiagramDraftStore.getState().getDraft(null);
		expect(persisted).not.toBeNull();
		expect(persisted!.source).toBe(MCP_SOURCE);
	});

	it("overwrites a pre-existing old draft when MCP pushes new source (full refresh scenario)", () => {
		vi.useFakeTimers();

		// Simulate a pre-existing draft in localStorage (what the user had before connecting)
		useDiagramDraftStore.getState().setDraft(null, {
			source: OLD_SOURCE,
			positions: {},
			notes: [],
			version: 3,
		});
		expect(useDiagramDraftStore.getState().getDraft(null)!.source).toBe(OLD_SOURCE);

		const rendered = renderHarness(OLD_SOURCE);
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		// Connect and go live
		act(() => {
			rendered.getApi().connect();
			MockWebSocket.instances[0]!.open();
			MockWebSocket.instances[0]!.serverMessage({
				type: "state-ack",
				state: {
					source: OLD_SOURCE,
					positions: {},
					notes: [],
					diagnostics: [],
					tableCount: 0,
					refCount: 0,
					baseline: null,
					updatedAt: 1_700_000_000_000,
				},
			});
		});

		expect(useWorkspaceStore.getState().status).toBe("live");

		// MCP agent writes a new schema
		act(() => {
			MockWebSocket.instances[0]!.serverMessage({
				type: "state-update",
				patch: { source: MCP_SOURCE, updatedAt: 1_700_000_001_000 },
			});
		});

		// Let the draft persistence debounce flush
		act(() => {
			vi.advanceTimersByTime(500);
		});

		// The draft must now be the MCP source, NOT the old source
		const persisted = useDiagramDraftStore.getState().getDraft(null);
		expect(persisted).not.toBeNull();
		expect(persisted!.source).toBe(MCP_SOURCE);

		// Simulate what getInitialAppState would read on refresh
		const refreshDraft = getInitialDraftState({
			route: { shareId: null, isDirty: false },
			draft: persisted,
			sampleSource: "// sample",
		});
		expect(refreshDraft.source).toBe(MCP_SOURCE);
	});
});
