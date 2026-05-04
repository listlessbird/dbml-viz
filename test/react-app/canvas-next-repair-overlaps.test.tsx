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
import { detectOverlappingTablePositions } from "@/diagram-layout/diagram-layout";
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

const threeTables: ParsedSchema = {
	tables: [
		{ id: "users", name: "users", columns: [], indexes: [] },
		{ id: "orders", name: "orders", columns: [], indexes: [] },
		{ id: "products", name: "products", columns: [], indexes: [] },
	],
	refs: [],
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

interface RenderOptions {
	readonly tablePositions: Record<string, { x: number; y: number }>;
	readonly source?: string;
	readonly stickyNotes?: ReadonlyArray<{ id: string; x: number; y: number }>;
	readonly fitView?: ReturnType<typeof vi.fn>;
}

interface RenderResult {
	readonly container: HTMLDivElement;
	readonly diagramStore: DiagramSessionStore;
	readonly runtimeStore: CanvasRuntimeStore;
}

function renderToolbar(options: RenderOptions): RenderResult {
	const diagramStore = createDiagramSessionStore({
		source: options.source ?? "",
		parsedSchema: threeTables,
		tablePositions: options.tablePositions,
		stickyNotes:
			options.stickyNotes?.map((note) => ({
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

const findRepair = (container: HTMLDivElement) =>
	container.querySelector<HTMLButtonElement>(
		"[data-testid='canvas-next-repair-overlaps']",
	);

describe("CanvasNextToolbar Repair overlaps", () => {
	it("renders a Repair overlaps button", () => {
		const { container } = renderToolbar({
			tablePositions: {
				users: { x: 0, y: 0 },
				orders: { x: 800, y: 0 },
				products: { x: 1600, y: 0 },
			},
		});
		expect(findRepair(container)).not.toBeNull();
	});

	it("commits non-overlapping Table Positions when overlaps exist", async () => {
		const fitView = vi.fn();
		stubAnimationFrame();
		const { container, diagramStore } = renderToolbar({
			tablePositions: {
				users: { x: 0, y: 0 },
				orders: { x: 20, y: 20 },
				products: { x: 1600, y: 0 },
			},
			fitView,
		});
		expect(
			detectOverlappingTablePositions(
				threeTables,
				diagramStore.getState().diagram.tablePositions,
			).hasOverlaps,
		).toBe(true);

		await act(async () => {
			findRepair(container)!.click();
		});

		expect(
			detectOverlappingTablePositions(
				threeTables,
				diagramStore.getState().diagram.tablePositions,
			).hasOverlaps,
		).toBe(false);
	});

	it("animates the Viewport after committing repaired positions", async () => {
		const fitView = vi.fn();
		const raf = stubAnimationFrame();
		const { container } = renderToolbar({
			tablePositions: {
				users: { x: 0, y: 0 },
				orders: { x: 20, y: 20 },
				products: { x: 1600, y: 0 },
			},
			fitView,
		});

		await act(async () => {
			findRepair(container)!.click();
		});
		raf.flush();

		expect(fitView).toHaveBeenCalledTimes(1);
	});

	it("is a no-op when no overlaps exist (Diagram identity preserved)", async () => {
		stubAnimationFrame();
		const { container, diagramStore } = renderToolbar({
			tablePositions: {
				users: { x: 0, y: 0 },
				orders: { x: 800, y: 0 },
				products: { x: 1600, y: 0 },
			},
		});
		const beforeDiagram = diagramStore.getState().diagram;

		await act(async () => {
			findRepair(container)!.click();
		});

		expect(diagramStore.getState().diagram).toBe(beforeDiagram);
	});

	it("does not change Schema Source or Sticky Notes when repairing", async () => {
		stubAnimationFrame();
		const { container, diagramStore } = renderToolbar({
			source: "Table users {}",
			tablePositions: {
				users: { x: 0, y: 0 },
				orders: { x: 20, y: 20 },
				products: { x: 1600, y: 0 },
			},
			stickyNotes: [{ id: "note-1", x: 50, y: 60 }],
		});
		const beforeSource = diagramStore.getState().diagram.source;
		const beforeNotes = diagramStore.getState().diagram.stickyNotes;

		await act(async () => {
			findRepair(container)!.click();
		});

		expect(diagramStore.getState().diagram.source).toBe(beforeSource);
		expect(diagramStore.getState().diagram.stickyNotes).toBe(beforeNotes);
	});

	it("disables the button when there are no Tables", () => {
		const diagramStore = createDiagramSessionStore({
			source: "",
			parsedSchema: { tables: [], refs: [], errors: [] },
			tablePositions: {},
			stickyNotes: [],
		});
		const runtimeStore = createCanvasRuntimeStore();
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

		expect(findRepair(container)?.disabled).toBe(true);
	});
});
