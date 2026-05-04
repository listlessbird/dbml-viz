import type { OnNodesChange, Viewport } from "@xyflow/react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

let capturedOnNodesChange: OnNodesChange | undefined;
let capturedOnViewportChange: ((viewport: Viewport) => void) | undefined;
let capturedNodeTypes: Record<string, unknown> | undefined;
let capturedEdgeTypes: Record<string, unknown> | undefined;
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
			nodeTypes,
			edgeTypes,
		}: {
			children: React.ReactNode;
			nodes: readonly unknown[];
			edges: readonly unknown[];
			onNodesChange?: OnNodesChange;
			onViewportChange?: (viewport: Viewport) => void;
			nodeTypes?: Record<string, unknown>;
			edgeTypes?: Record<string, unknown>;
		}) => {
			reactFlowRenderCount += 1;
			capturedOnNodesChange = onNodesChange;
			capturedOnViewportChange = onViewportChange;
			capturedNodeTypes = nodeTypes;
			capturedEdgeTypes = edgeTypes;
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
import type { ParsedSchema, SharedStickyNote } from "@/types";

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
	refs: [],
	errors: [],
};

const stickyNote: SharedStickyNote = {
	id: "sticky-1",
	x: 20,
	y: 30,
	width: 220,
	height: 180,
	color: "yellow",
	text: "Review #users",
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
	capturedNodeTypes = undefined;
	capturedEdgeTypes = undefined;
	reactFlowRenderCount = 0;
	vi.unstubAllGlobals();
});

const renderCanvasNext = (
	initial: {
		readonly parsedSchema?: ParsedSchema;
		readonly tablePositions?: Record<string, { readonly x: number; readonly y: number }>;
		readonly stickyNotes?: readonly SharedStickyNote[];
	} = {},
) => {
	const diagramStore = createDiagramSessionStore({
		source: "",
		parsedSchema: initial.parsedSchema ?? usersOnly,
		tablePositions: initial.tablePositions ?? { users: { x: 0, y: 0 } },
		stickyNotes: initial.stickyNotes ?? [],
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
	it("registers custom Canvas Projection renderers with React Flow", () => {
		renderCanvasNext();

		expect(capturedNodeTypes).toEqual(
			expect.objectContaining({
				table: expect.anything(),
				sticky: expect.anything(),
			}),
		);
		expect(capturedEdgeTypes).toEqual(
			expect.objectContaining({
				relationship: expect.anything(),
				stickyLink: expect.anything(),
			}),
		);
	});

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

	it("commits React Flow Sticky Note position changes through Diagram Session", () => {
		const { diagramStore } = renderCanvasNext({
			stickyNotes: [stickyNote],
		});

		act(() => {
			capturedOnNodesChange?.([
				{
					id: "sticky-1",
					type: "position",
					position: { x: 144, y: 288 },
					dragging: false,
				},
			]);
		});

		expect(diagramStore.getState().diagram.stickyNotes).toEqual([
			{
				...stickyNote,
				x: 144,
				y: 288,
			},
		]);
	});

	it("commits deterministic fallback Table Positions for newly added Tables", () => {
		const { diagramStore } = renderCanvasNext({
			parsedSchema: usersAndOrders,
			tablePositions: { users: { x: 0, y: 0 } },
		});

		const positions = diagramStore.getState().diagram.tablePositions;
		expect(positions.users).toEqual({ x: 0, y: 0 });
		expect(positions.orders?.x).toBeGreaterThan(0);
		expect(positions.orders?.y).toBeGreaterThan(0);
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
