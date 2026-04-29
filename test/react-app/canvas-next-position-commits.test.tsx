import type { OnNodesChange, Viewport } from "@xyflow/react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

let capturedOnNodesChange: OnNodesChange | undefined;
let capturedOnViewportChange: ((viewport: Viewport) => void) | undefined;
let reactFlowRenderCount = 0;

vi.mock("@/schema-source/parse-schema-source", () => ({
	parseSchemaSource: vi.fn(() => new Promise(() => {})),
}));

vi.mock("@xyflow/react", async () => {
	const actual = await vi.importActual<typeof import("@xyflow/react")>(
		"@xyflow/react",
	);
	const React = await import("react");

	return {
		...actual,
		Background: () => React.createElement("div", { "data-testid": "background" }),
		Controls: () => React.createElement("div", { "data-testid": "controls" }),
		MiniMap: () => React.createElement("div", { "data-testid": "minimap" }),
		ReactFlow: ({
			children,
			nodes,
			edges,
			onNodesChange,
			onViewportChange,
		}: {
			children: React.ReactNode;
			nodes: readonly unknown[];
			edges: readonly unknown[];
			onNodesChange?: OnNodesChange;
			onViewportChange?: (viewport: Viewport) => void;
		}) => {
			reactFlowRenderCount += 1;
			capturedOnNodesChange = onNodesChange;
			capturedOnViewportChange = onViewportChange;
			return React.createElement(
				"div",
				{
					"data-testid": "canvas-next-react-flow",
					"data-node-count": nodes.length,
					"data-edge-count": edges.length,
				},
				children,
			);
		},
	};
});

import { CanvasRuntimeContext } from "@/canvas-next/canvas-runtime-context";
import { createCanvasRuntimeStore } from "@/canvas-next/canvas-runtime-store";
import { CanvasNextCanvas } from "@/canvas-next/canvas";
import { DiagramSessionContext } from "@/diagram-session/diagram-session-context";
import { createDiagramSessionStore } from "@/diagram-session/diagram-session-store";
import type { ParsedSchema } from "@/types";

const usersOnly: ParsedSchema = {
	tables: [{ id: "users", name: "users", columns: [], indexes: [] }],
	refs: [],
	errors: [],
};

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
	capturedOnNodesChange = undefined;
	capturedOnViewportChange = undefined;
	reactFlowRenderCount = 0;
	vi.unstubAllGlobals();
});

const renderCanvasNext = () => {
	const diagramStore = createDiagramSessionStore({
		source: "",
		parsedSchema: usersOnly,
		tablePositions: { users: { x: 0, y: 0 } },
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
					<CanvasNextCanvas />
				</CanvasRuntimeContext>
			</DiagramSessionContext>,
		);
	});

	activeRoot = root;
	activeContainer = container;

	return { diagramStore, runtimeStore };
};

describe("canvas-next Table Position commits", () => {
	it("commits React Flow Table position changes through Diagram Session", () => {
		const { diagramStore } = renderCanvasNext();

		act(() => {
			capturedOnNodesChange?.([
				{
					id: "users",
					type: "position",
					position: { x: 112, y: 244 },
					dragging: false,
				},
			]);
		});

		expect(diagramStore.getState().diagram.tablePositions).toEqual({
			users: { x: 112, y: 244 },
		});
	});

	it("keeps Viewport and Selection changes out of durable Diagram state", () => {
		const { diagramStore, runtimeStore } = renderCanvasNext();
		const before = diagramStore.getState().toSchemaPayload();

		act(() => {
			capturedOnViewportChange?.({ x: 10, y: 20, zoom: 1.4 });
			capturedOnNodesChange?.([{ id: "users", type: "select", selected: true }]);
		});

		expect(runtimeStore.getState().viewport).toEqual({
			x: 10,
			y: 20,
			zoom: 1.4,
		});
		expect(diagramStore.getState().toSchemaPayload()).toEqual(before);
	});

	it("does not rerender React Flow for Schema Source-only edits", () => {
		const { diagramStore } = renderCanvasNext();
		const renderCount = reactFlowRenderCount;

		act(() => {
			diagramStore.getState().setSchemaSource("Table users { id int [pk] }");
		});

		expect(reactFlowRenderCount).toBe(renderCount);
	});

	it("does not rerender React Flow for Focus commands without visual projection output", () => {
		vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
		vi.stubGlobal("cancelAnimationFrame", vi.fn());
		const { diagramStore, runtimeStore } = renderCanvasNext();
		const before = diagramStore.getState().toSchemaPayload();
		const renderCount = reactFlowRenderCount;

		act(() => {
			runtimeStore.getState().requestFocus(["users", "users"]);
		});

		expect(runtimeStore.getState().focusTableIds).toEqual(["users"]);
		expect(diagramStore.getState().toSchemaPayload()).toEqual(before);
		expect(reactFlowRenderCount).toBe(renderCount);
	});
});
