import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CanvasRuntimeContext } from "@/canvas-next/canvas-runtime-context";
import {
	createCanvasRuntimeStore,
	type CanvasRuntimeStore,
} from "@/canvas-next/canvas-runtime-store";
import { useParseDrivenFocus } from "@/canvas-next/use-parse-driven-focus";
import { DiagramSessionContext } from "@/diagram-session/diagram-session-context";
import {
	createDiagramSessionStore,
	type DiagramSessionStore,
} from "@/diagram-session/diagram-session-store";
import type { ParsedSchema } from "@/types";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
	if (root) {
		act(() => {
			root?.unmount();
		});
	}
	container?.remove();
	root = null;
	container = null;
	vi.unstubAllGlobals();
});

const stubAnimationFrame = () => {
	let nextFrameId = 1;
	const callbacks = new Map<number, FrameRequestCallback>();
	vi.stubGlobal(
		"requestAnimationFrame",
		vi.fn((callback: FrameRequestCallback) => {
			const id = nextFrameId;
			nextFrameId += 1;
			callbacks.set(id, callback);
			return id;
		}),
	);
	vi.stubGlobal(
		"cancelAnimationFrame",
		vi.fn((id: number) => {
			callbacks.delete(id);
		}),
	);
	return {
		flush: () => {
			const pending = Array.from(callbacks.entries());
			callbacks.clear();
			for (const [id, callback] of pending) {
				callback(id);
			}
		},
	};
};

const usersOnly: ParsedSchema = {
	tables: [{ id: "users", name: "users", columns: [], indexes: [] }],
	refs: [],
	errors: [],
};

const usersAndOrders: ParsedSchema = {
	tables: [
		{ id: "users", name: "users", columns: [], indexes: [] },
		{ id: "orders", name: "orders", columns: [], indexes: [] },
	],
	refs: [
		{
			id: "fk_orders_users:0",
			from: { table: "orders", columns: ["user_id"] },
			to: { table: "users", columns: ["id"] },
			type: "many_to_one",
		},
	],
	errors: [],
};

const renderBridge = (
	sessionStore: DiagramSessionStore,
	runtimeStore: CanvasRuntimeStore,
) => {
	const Bridge = () => {
		useParseDrivenFocus();
		return null;
	};
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	act(() => {
		root!.render(
			<DiagramSessionContext value={sessionStore}>
				<CanvasRuntimeContext value={runtimeStore}>
					<Bridge />
				</CanvasRuntimeContext>
			</DiagramSessionContext>,
		);
	});
};

describe("Canvas Next parse-driven focus", () => {
	it("focuses a single newly-added Table after a Schema Source edit", () => {
		const raf = stubAnimationFrame();
		const sessionStore = createDiagramSessionStore();
		const runtimeStore = createCanvasRuntimeStore();
		const fitView = vi.fn();
		runtimeStore
			.getState()
			.attachReactFlowInstance({ fitView } as never);

		renderBridge(sessionStore, runtimeStore);

		act(() => {
			sessionStore.getState().applyParseResult({
				ok: true,
				parsedSchema: usersOnly,
				metadata: { format: "dbml" },
			});
		});
		raf.flush();

		expect(runtimeStore.getState().focusTableIds).toEqual(["users"]);
		expect(fitView).toHaveBeenCalledWith({
			padding: 0.16,
			duration: 500,
			nodes: [{ id: "users" }],
		});
	});

	it("focuses the full set on a bulk paste with zero prior Tables", () => {
		const raf = stubAnimationFrame();
		const sessionStore = createDiagramSessionStore();
		const runtimeStore = createCanvasRuntimeStore();
		const fitView = vi.fn();
		runtimeStore
			.getState()
			.attachReactFlowInstance({ fitView } as never);

		renderBridge(sessionStore, runtimeStore);

		act(() => {
			sessionStore.getState().applyParseResult({
				ok: true,
				parsedSchema: usersAndOrders,
				metadata: { format: "dbml" },
			});
		});
		raf.flush();

		expect(runtimeStore.getState().focusTableIds).toEqual([
			"users",
			"orders",
		]);
		expect(fitView).toHaveBeenCalledTimes(1);
		expect(fitView).toHaveBeenCalledWith({
			padding: 0.16,
			duration: 500,
			nodes: [{ id: "users" }, { id: "orders" }],
		});
	});

	it("focuses only the newly-added Table on an incremental edit", () => {
		const raf = stubAnimationFrame();
		const sessionStore = createDiagramSessionStore();
		const runtimeStore = createCanvasRuntimeStore();
		const fitView = vi.fn();
		runtimeStore
			.getState()
			.attachReactFlowInstance({ fitView } as never);

		renderBridge(sessionStore, runtimeStore);

		act(() => {
			sessionStore.getState().applyParseResult({
				ok: true,
				parsedSchema: usersOnly,
				metadata: { format: "dbml" },
			});
		});
		raf.flush();
		fitView.mockClear();

		act(() => {
			sessionStore.getState().applyParseResult({
				ok: true,
				parsedSchema: usersAndOrders,
				metadata: { format: "dbml" },
			});
		});
		raf.flush();

		expect(runtimeStore.getState().focusTableIds).toEqual(["orders"]);
		expect(fitView).toHaveBeenCalledTimes(1);
		expect(fitView).toHaveBeenCalledWith({
			padding: 0.16,
			duration: 500,
			nodes: [{ id: "orders" }],
		});
	});

	it("does not focus on hydrate even when the Diagram has Tables", () => {
		const raf = stubAnimationFrame();
		const sessionStore = createDiagramSessionStore();
		const runtimeStore = createCanvasRuntimeStore();
		const fitView = vi.fn();
		runtimeStore
			.getState()
			.attachReactFlowInstance({ fitView } as never);

		renderBridge(sessionStore, runtimeStore);

		act(() => {
			sessionStore.getState().hydrateDiagram({
				source: "Table users {}",
				parsedSchema: usersAndOrders,
				tablePositions: { users: { x: 0, y: 0 }, orders: { x: 200, y: 0 } },
				stickyNotes: [],
			});
		});
		raf.flush();

		expect(runtimeStore.getState().focusTableIds).toEqual([]);
		expect(fitView).not.toHaveBeenCalled();
	});

	it("does not focus when a parse failure leaves the Parsed Schema unchanged", () => {
		const raf = stubAnimationFrame();
		const sessionStore = createDiagramSessionStore();
		const runtimeStore = createCanvasRuntimeStore();
		const fitView = vi.fn();
		runtimeStore
			.getState()
			.attachReactFlowInstance({ fitView } as never);

		renderBridge(sessionStore, runtimeStore);

		act(() => {
			sessionStore.getState().applyParseResult({
				ok: true,
				parsedSchema: usersOnly,
				metadata: { format: "dbml" },
			});
		});
		raf.flush();
		fitView.mockClear();
		runtimeStore.getState().clearFocus();

		act(() => {
			sessionStore.getState().applyParseResult({
				ok: false,
				diagnostics: [{ message: "boom" }],
			});
		});
		raf.flush();

		expect(runtimeStore.getState().focusTableIds).toEqual([]);
		expect(fitView).not.toHaveBeenCalled();
	});

	it("does not focus when an edit only removes Tables", () => {
		const raf = stubAnimationFrame();
		const sessionStore = createDiagramSessionStore();
		const runtimeStore = createCanvasRuntimeStore();
		const fitView = vi.fn();
		runtimeStore
			.getState()
			.attachReactFlowInstance({ fitView } as never);

		renderBridge(sessionStore, runtimeStore);

		act(() => {
			sessionStore.getState().applyParseResult({
				ok: true,
				parsedSchema: usersAndOrders,
				metadata: { format: "dbml" },
			});
		});
		raf.flush();
		fitView.mockClear();
		runtimeStore.getState().clearFocus();

		act(() => {
			sessionStore.getState().applyParseResult({
				ok: true,
				parsedSchema: usersOnly,
				metadata: { format: "dbml" },
			});
		});
		raf.flush();

		expect(runtimeStore.getState().focusTableIds).toEqual([]);
		expect(fitView).not.toHaveBeenCalled();
	});

	it("focuses an isolated incremental add (no Relationship to existing Tables)", () => {
		const raf = stubAnimationFrame();
		const sessionStore = createDiagramSessionStore();
		const runtimeStore = createCanvasRuntimeStore();
		const fitView = vi.fn();
		runtimeStore
			.getState()
			.attachReactFlowInstance({ fitView } as never);

		renderBridge(sessionStore, runtimeStore);

		act(() => {
			sessionStore.getState().applyParseResult({
				ok: true,
				parsedSchema: usersOnly,
				metadata: { format: "dbml" },
			});
		});
		raf.flush();
		fitView.mockClear();

		const usersPlusIsolated: ParsedSchema = {
			tables: [
				{ id: "users", name: "users", columns: [], indexes: [] },
				{ id: "audit_log", name: "audit_log", columns: [], indexes: [] },
			],
			refs: [],
			errors: [],
		};
		act(() => {
			sessionStore.getState().applyParseResult({
				ok: true,
				parsedSchema: usersPlusIsolated,
				metadata: { format: "dbml" },
			});
		});
		raf.flush();

		expect(runtimeStore.getState().focusTableIds).toEqual(["audit_log"]);
		expect(fitView).toHaveBeenCalledWith({
			padding: 0.16,
			duration: 500,
			nodes: [{ id: "audit_log" }],
		});
	});

	it("records focus state without crashing when no React Flow instance is attached", () => {
		const raf = stubAnimationFrame();
		const sessionStore = createDiagramSessionStore();
		const runtimeStore = createCanvasRuntimeStore();

		renderBridge(sessionStore, runtimeStore);

		act(() => {
			sessionStore.getState().applyParseResult({
				ok: true,
				parsedSchema: usersOnly,
				metadata: { format: "dbml" },
			});
		});
		raf.flush();

		expect(runtimeStore.getState().focusTableIds).toEqual(["users"]);
	});
});
