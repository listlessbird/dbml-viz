import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@xyflow/react", async () => {
	const React = await import("react");

	return {
		Background: () => React.createElement("div", { "data-testid": "background" }),
		BackgroundVariant: { Dots: "dots" },
		Controls: () => React.createElement("div", { "data-testid": "controls" }),
		MiniMap: () => React.createElement("div", { "data-testid": "minimap" }),
		ReactFlow: ({
			children,
			nodes,
			edges,
		}: {
			children: React.ReactNode;
			nodes: readonly unknown[];
			edges: readonly unknown[];
		}) =>
			React.createElement(
				"div",
				{
					"data-testid": "canvas-next-react-flow",
					"data-node-count": nodes.length,
					"data-edge-count": edges.length,
					"data-node-ids": nodes
						.map((node) =>
							typeof node === "object" && node !== null && "id" in node
								? String(node.id)
								: "",
						)
						.join(","),
				},
				children,
			),
	};
});

import { CanvasNextPage } from "@/canvas-next/canvas-page";
import type {
	DiagramPersistenceAdapter,
	DraftPersistenceAdapter,
} from "@/canvas-next/diagram-persistence-adapter";
import type { SchemaPayload } from "@/types";
import type {
	WorkspaceTransport,
	WorkspaceTransportHandlers,
} from "@/workspace/workspace-store";
import type { ClientWorkspaceMessage } from "@/types/workspace";
import { SAMPLE_SCHEMA_SOURCE } from "@/lib/sample-dbml";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

class FakeWorkspaceTransport implements WorkspaceTransport {
	readonly sent: ClientWorkspaceMessage[] = [];
	readonly closeCalls: unknown[] = [];

	constructor(readonly handlers: WorkspaceTransportHandlers) {}

	send(message: ClientWorkspaceMessage) {
		this.sent.push(message);
		return true;
	}

	close(code?: number, reason?: string) {
		this.closeCalls.push({ code, reason });
	}

	open() {
		this.handlers.onOpen();
	}
}

afterEach(() => {
	if (root) {
		act(() => {
			root?.unmount();
		});
	}
	container?.remove();
	root = null;
	container = null;
	window.history.replaceState({}, "", "/");
});

describe("CanvasNextPage draft hydration", () => {
	it("reads the draft once on mount and feeds it into the Diagram Session", () => {
		const draft: SchemaPayload = {
			source: "Table hydrated_table { id int }",
			positions: { hydrated_table: { x: 11, y: 22 } },
			notes: [],
			version: 3,
		};
		const getDraftCalls: (string | null)[] = [];
		const fakeAdapter: DraftPersistenceAdapter = {
			getDraft: (shareId) => {
				getDraftCalls.push(shareId);
				return draft;
			},
			setDraft: () => {},
			clearDraft: () => {},
		};

		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		act(() => {
			root?.render(<CanvasNextPage adapter={fakeAdapter} />);
		});

		expect(getDraftCalls).toEqual([null]);
		expect(
			container.querySelector('[data-testid="canvas-next-react-flow"]'),
		).toBeTruthy();
	});

	it("loads a clean shared route without projecting stale local Sticky Notes first", async () => {
		window.history.replaceState({}, "", "/s/share-1");

		const staleDraft: SchemaPayload = {
			source: "Table stale_table { id int }",
			positions: {},
			notes: [
				{
					id: "stale-note",
					x: 1,
					y: 2,
					width: 120,
					height: 90,
					color: "pink",
					text: "stale",
				},
			],
			version: 3,
		};
		const remotePayload: SchemaPayload = {
			source: "Table remote_table { id int }",
			positions: {},
			notes: [
				{
					id: "remote-note",
					x: 3,
					y: 4,
					width: 140,
					height: 100,
					color: "green",
					text: "remote",
				},
			],
			version: 3,
		};
		const fakeAdapter: DiagramPersistenceAdapter = {
			getDraft: vi.fn(() => staleDraft),
			setDraft: vi.fn(),
			clearDraft: vi.fn(),
			loadShare: vi.fn(async () => remotePayload),
			saveShare: vi.fn(),
		};

		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		act(() => {
			root?.render(<CanvasNextPage adapter={fakeAdapter} />);
		});

		expect(
			container.querySelector('[data-testid="canvas-next-react-flow"]')?.getAttribute("data-node-count"),
		).toBe("0");

		await vi.waitFor(() => {
			expect(fakeAdapter.loadShare).toHaveBeenCalledWith("share-1");
			expect(
				container
					?.querySelector('[data-testid="canvas-next-react-flow"]')
					?.getAttribute("data-node-count"),
			).toBe("1");
		});
		expect(container.textContent).toContain("share-1");
	});

	it("keeps a dirty shared draft visible while loading the remote Share Baseline", async () => {
		window.history.replaceState({}, "", "/s/share-1?dirty=true");

		const dirtyDraft: SchemaPayload = {
			source: "Table dirty_table { id int }",
			positions: {},
			notes: [
				{
					id: "dirty-note",
					x: 1,
					y: 2,
					width: 120,
					height: 90,
					color: "pink",
					text: "dirty",
				},
			],
			version: 3,
		};
		const remotePayload: SchemaPayload = {
			source: "Table remote_table { id int }",
			positions: {},
			notes: [
				{
					id: "remote-note",
					x: 3,
					y: 4,
					width: 140,
					height: 100,
					color: "green",
					text: "remote",
				},
			],
			version: 3,
		};
		const fakeAdapter: DiagramPersistenceAdapter = {
			getDraft: vi.fn(() => dirtyDraft),
			setDraft: vi.fn(),
			clearDraft: vi.fn(),
			loadShare: vi.fn(async () => remotePayload),
			saveShare: vi.fn(),
		};

		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		act(() => {
			root?.render(<CanvasNextPage adapter={fakeAdapter} />);
		});

		const reactFlow = () =>
			container?.querySelector('[data-testid="canvas-next-react-flow"]');
		expect(reactFlow()?.getAttribute("data-node-ids")).toBe("dirty-note");

		await vi.waitFor(() => {
			expect(fakeAdapter.loadShare).toHaveBeenCalledWith("share-1");
			expect(reactFlow()?.getAttribute("data-node-ids")).toBe("dirty-note");
		});
		expect(container.textContent).toContain("Local edits not shared");
		expect(fakeAdapter.clearDraft).not.toHaveBeenCalledWith("share-1");
	});

	it("connects a scoped Workspace from the canvas-next shell", () => {
		const transports: FakeWorkspaceTransport[] = [];
		const fakeAdapter: DraftPersistenceAdapter = {
			getDraft: () => null,
			setDraft: () => {},
			clearDraft: () => {},
		};

		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		act(() => {
			root?.render(
				<CanvasNextPage
					adapter={fakeAdapter}
					workspaceAdapter={{
						createWorkspaceId: () => "workspace-page",
						createTransport: (_workspaceId, handlers) => {
							const transport = new FakeWorkspaceTransport(handlers);
							transports.push(transport);
							return transport;
						},
					}}
				/>,
			);
		});

		const connectButton = container.querySelector(
			'[data-status="offline"]',
		) as HTMLButtonElement | null;
		expect(connectButton?.textContent).toContain("Connect workspace");

		act(() => {
			connectButton?.click();
			transports[0]?.open();
		});

		expect(transports[0]?.sent).toEqual([
			{
				type: "attach",
				state: {
					source: SAMPLE_SCHEMA_SOURCE,
					positions: {},
					notes: [],
					baseline: null,
				},
				updatedAt: 0,
			},
		]);
		expect(container.querySelector('[data-status="connecting"]')).toBeTruthy();
	});
});
