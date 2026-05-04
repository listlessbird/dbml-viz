import type { ReactFlowInstance } from "@xyflow/react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CanvasNextToolbar } from "@/canvas-next/canvas-toolbar";
import { CanvasRuntimeContext } from "@/canvas-next/canvas-runtime-context";
import { createCanvasRuntimeStore } from "@/canvas-next/canvas-runtime-store";
import { DiagramSessionContext } from "@/diagram-session/diagram-session-context";
import {
	createDiagramSessionStore,
	type DiagramSessionStore,
} from "@/diagram-session/diagram-session-store";
import type { CanvasEdge, CanvasNode } from "@/types";

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
});

const fakeFlowInstance = (
	mapped: { x: number; y: number } = { x: 100, y: 200 },
): ReactFlowInstance<CanvasNode, CanvasEdge> => {
	const partial = {
		screenToFlowPosition: vi.fn(() => mapped),
	};
	return partial as unknown as ReactFlowInstance<CanvasNode, CanvasEdge>;
};

interface RenderResult {
	readonly container: HTMLDivElement;
	readonly diagramStore: DiagramSessionStore;
	readonly runtimeStore: ReturnType<typeof createCanvasRuntimeStore>;
}

function renderToolbar(
	flowMapped?: { x: number; y: number },
): RenderResult {
	const diagramStore = createDiagramSessionStore({
		source: "",
		parsedSchema: { tables: [], refs: [], errors: [] },
		tablePositions: {},
		stickyNotes: [],
	});
	const runtimeStore = createCanvasRuntimeStore();
	if (flowMapped !== undefined) {
		runtimeStore.getState().attachReactFlowInstance(fakeFlowInstance(flowMapped));
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

describe("CanvasNextToolbar", () => {
	it("renders an Add sticky note button", () => {
		const { container } = renderToolbar();
		const btn = container.querySelector<HTMLButtonElement>(
			"[data-testid='canvas-next-add-sticky']",
		);
		expect(btn).not.toBeNull();
	});

	it("disables the button until a React Flow instance is attached", () => {
		const { container } = renderToolbar();
		const btn = container.querySelector<HTMLButtonElement>(
			"[data-testid='canvas-next-add-sticky']",
		);
		expect(btn?.disabled).toBe(true);
	});

	it("spawns a sticky note via Diagram Session when clicked after instance attaches", () => {
		const { container, diagramStore } = renderToolbar({ x: 75, y: 125 });
		const btn = container.querySelector<HTMLButtonElement>(
			"[data-testid='canvas-next-add-sticky']",
		);
		expect(btn?.disabled).toBe(false);

		act(() => {
			btn!.click();
		});

		const notes = diagramStore.getState().diagram.stickyNotes;
		expect(notes).toHaveLength(1);
		expect(notes[0]?.x).toBe(75);
		expect(notes[0]?.y).toBe(125);
		expect(notes[0]?.color).toBe("yellow");
		expect(notes[0]?.text).toBe("");
	});
});
