import type { ReactFlowInstance } from "@xyflow/react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CanvasNextToolbar } from "@/canvas-next/canvas-toolbar";
import { CanvasRuntimeContext } from "@/canvas-next/canvas-runtime-context";
import {
	createCanvasRuntimeStore,
	type CanvasRuntimeStore,
} from "@/canvas-next/canvas-runtime-store";
import { DiagramSessionContext } from "@/diagram-session/diagram-session-context";
import {
	createDiagramSessionStore,
	type DiagramSessionStore,
} from "@/diagram-session/diagram-session-store";
import type { CanvasEdge, CanvasNode, ParsedSchema } from "@/types";

let activeRoot: Root | null = null;
let activeContainer: HTMLDivElement | null = null;

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
	}
	activeContainer?.remove();
	activeRoot = null;
	activeContainer = null;
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

const fakeFlowInstance = (
	fitView: ReturnType<typeof vi.fn>,
): ReactFlowInstance<CanvasNode, CanvasEdge> => {
	const partial = {
		fitView,
		screenToFlowPosition: vi.fn(() => ({ x: 0, y: 0 })),
	};
	return partial as unknown as ReactFlowInstance<CanvasNode, CanvasEdge>;
};

interface RenderResult {
	readonly container: HTMLDivElement;
	readonly diagramStore: DiagramSessionStore;
	readonly runtimeStore: CanvasRuntimeStore;
}

interface RenderOptions {
	readonly diagram?: {
		readonly source?: string;
		readonly parsedSchema: ParsedSchema;
		readonly tablePositions?: Record<string, { x: number; y: number }>;
		readonly stickyNotes?: ReadonlyArray<{
			readonly id: string;
			readonly x: number;
			readonly y: number;
		}>;
	};
	readonly fitView?: ReturnType<typeof vi.fn>;
}

function renderToolbar(options: RenderOptions = {}): RenderResult {
	const diagramStore = createDiagramSessionStore({
		source: options.diagram?.source ?? "",
		parsedSchema: options.diagram?.parsedSchema ?? {
			tables: [],
			refs: [],
			errors: [],
		},
		tablePositions: options.diagram?.tablePositions ?? {},
		stickyNotes:
			options.diagram?.stickyNotes?.map((note) => ({
				id: note.id,
				x: note.x,
				y: note.y,
				width: 200,
				height: 120,
				color: "yellow",
				text: "",
			})) ?? [],
	});
	const runtimeStore = createCanvasRuntimeStore();
	if (options.fitView) {
		runtimeStore
			.getState()
			.attachReactFlowInstance(fakeFlowInstance(options.fitView));
	}

	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);
	act(() => {
		root.render(
			<DiagramSessionContext value={diagramStore}>
				<CanvasRuntimeContext value={runtimeStore}>
					<CanvasNextToolbar />
				</CanvasRuntimeContext>
			</DiagramSessionContext>,
		);
	});
	activeRoot = root;
	activeContainer = container;
	return { container, diagramStore, runtimeStore };
}

const findAutoArrange = (container: HTMLDivElement) =>
	container.querySelector<HTMLButtonElement>(
		"[data-testid='canvas-next-auto-arrange']",
	);

describe("CanvasNextToolbar Auto-arrange", () => {
	it("renders an Auto-arrange button", () => {
		const { container } = renderToolbar({
			diagram: { parsedSchema: usersAndOrders },
		});
		expect(findAutoArrange(container)).not.toBeNull();
	});

	it("commits new Table Positions for every Table when clicked", async () => {
		const fitView = vi.fn();
		stubAnimationFrame();
		const { container, diagramStore } = renderToolbar({
			diagram: {
				parsedSchema: usersAndOrders,
				tablePositions: { users: { x: 0, y: 0 }, orders: { x: 0, y: 0 } },
			},
			fitView,
		});

		const before = diagramStore.getState().diagram.tablePositions;
		await act(async () => {
			findAutoArrange(container)!.click();
		});

		const after = diagramStore.getState().diagram.tablePositions;
		expect(Object.keys(after).sort()).toEqual(["orders", "users"]);
		expect(after).not.toBe(before);
		// At least one Table moved off the seed (0, 0)
		expect(
			Object.values(after).some(
				(position) => position.x !== 0 || position.y !== 0,
			),
		).toBe(true);
	});

	it("does not change Sticky Notes or Schema Source on arrange", async () => {
		const fitView = vi.fn();
		stubAnimationFrame();
		const { container, diagramStore } = renderToolbar({
			diagram: {
				source: "Table users {}\nTable orders {}",
				parsedSchema: usersAndOrders,
				tablePositions: { users: { x: 0, y: 0 }, orders: { x: 0, y: 0 } },
				stickyNotes: [{ id: "note-1", x: 50, y: 60 }],
			},
			fitView,
		});

		const beforeSource = diagramStore.getState().diagram.source;
		const beforeNotes = diagramStore.getState().diagram.stickyNotes;
		await act(async () => {
			findAutoArrange(container)!.click();
		});

		expect(diagramStore.getState().diagram.source).toBe(beforeSource);
		expect(diagramStore.getState().diagram.stickyNotes).toBe(beforeNotes);
	});

	it("animates the Viewport to the arranged Tables after commit", async () => {
		const fitView = vi.fn();
		const raf = stubAnimationFrame();
		const { container } = renderToolbar({
			diagram: {
				parsedSchema: usersAndOrders,
				tablePositions: { users: { x: 0, y: 0 }, orders: { x: 0, y: 0 } },
			},
			fitView,
		});

		await act(async () => {
			findAutoArrange(container)!.click();
		});
		raf.flush();

		expect(fitView).toHaveBeenCalledTimes(1);
		expect(fitView).toHaveBeenCalledWith({
			padding: 0.16,
			duration: 500,
		});
	});

	it("disables the Auto-arrange button when there are no Tables", () => {
		const { container } = renderToolbar({
			diagram: { parsedSchema: { tables: [], refs: [], errors: [] } },
		});
		expect(findAutoArrange(container)?.disabled).toBe(true);
	});
});
