import type { OnNodesChange, Viewport } from "@xyflow/react";
import { act, type MouseEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CanvasEdge } from "@/types";

let capturedOnNodesChange: OnNodesChange | undefined;
let capturedOnViewportChange: ((viewport: Viewport) => void) | undefined;
let capturedOnEdgeClick:
	| ((event: MouseEvent, edge: CanvasEdge) => void)
	| undefined;
let capturedOnPaneClick: ((event: MouseEvent) => void) | undefined;
let capturedNodeTypes: Record<string, unknown> | undefined;
let capturedEdgeTypes: Record<string, unknown> | undefined;
let capturedOnlyRenderVisibleElements: boolean | undefined;
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
			onEdgeClick,
			onPaneClick,
			nodeTypes,
			edgeTypes,
			onlyRenderVisibleElements,
		}: {
			children: React.ReactNode;
			nodes: readonly unknown[];
			edges: readonly unknown[];
			onNodesChange?: OnNodesChange;
			onViewportChange?: (viewport: Viewport) => void;
			onEdgeClick?: (event: MouseEvent, edge: CanvasEdge) => void;
			onPaneClick?: (event: MouseEvent) => void;
			nodeTypes?: Record<string, unknown>;
			edgeTypes?: Record<string, unknown>;
			onlyRenderVisibleElements?: boolean;
		}) => {
			reactFlowRenderCount += 1;
			capturedOnNodesChange = onNodesChange;
			capturedOnViewportChange = onViewportChange;
			capturedOnEdgeClick = onEdgeClick;
			capturedOnPaneClick = onPaneClick;
			capturedNodeTypes = nodeTypes;
			capturedEdgeTypes = edgeTypes;
			capturedOnlyRenderVisibleElements = onlyRenderVisibleElements;
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

const usersOrdersAndPayments: ParsedSchema = {
	tables: [
		{ id: "users", name: "users", columns: [], indexes: [] },
		{ id: "orders", name: "orders", columns: [], indexes: [] },
		{ id: "payments", name: "payments", columns: [], indexes: [] },
	],
	refs: [
		{
			id: "fk_orders_users:0",
			from: { table: "orders", columns: ["user_id"] },
			to: { table: "users", columns: ["id"] },
			type: "many_to_one",
		},
		{
			id: "fk_payments_orders:0",
			from: { table: "payments", columns: ["order_id"] },
			to: { table: "orders", columns: ["id"] },
			type: "many_to_one",
		},
	],
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
	capturedOnEdgeClick = undefined;
	capturedOnPaneClick = undefined;
	capturedNodeTypes = undefined;
	capturedEdgeTypes = undefined;
	capturedOnlyRenderVisibleElements = undefined;
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
		source: "-- seeded --",
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

const schemaWithTables = (tableCount: number): ParsedSchema => ({
	tables: Array.from({ length: tableCount }, (_, index) => {
		const id = `table_${index}`;
		return { id, name: id, columns: [], indexes: [] };
	}),
	refs: [],
	errors: [],
});

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

	it("keeps the MiniMap and full React Flow rendering on small diagrams", () => {
		renderCanvasNext({
			parsedSchema: schemaWithTables(80),
			tablePositions: {},
		});

		expect(capturedOnlyRenderVisibleElements).toBe(false);
		expect(activeContainer?.querySelector("[data-testid='minimap']")).toBeTruthy();
	});

	it("hides the MiniMap above the large-diagram threshold", () => {
		renderCanvasNext({
			parsedSchema: schemaWithTables(81),
			tablePositions: {},
		});

		expect(capturedOnlyRenderVisibleElements).toBe(false);
		expect(activeContainer?.querySelector("[data-testid='minimap']")).toBeNull();
	});

	it("enables visible-only React Flow rendering for very large diagrams", () => {
		renderCanvasNext({
			parsedSchema: schemaWithTables(151),
			tablePositions: {},
		});

		expect(capturedOnlyRenderVisibleElements).toBe(true);
		expect(activeContainer?.querySelector("[data-testid='minimap']")).toBeNull();
	});

	it("commits React Flow Sticky Note position changes through Diagram Session", () => {
		const stickyNote: SharedStickyNote = {
			id: "sticky-1",
			color: "yellow",
			text: "Review #users",
			x: 20,
			y: 30,
		};
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

	it("does not synthesize missing Table Positions from the Canvas", () => {
		const { diagramStore } = renderCanvasNext({
			parsedSchema: usersAndOrders,
			tablePositions: { users: { x: 0, y: 0 } },
		});

		const positions = diagramStore.getState().diagram.tablePositions;
		expect(positions.users).toEqual({ x: 0, y: 0 });
		expect(positions.orders).toBeUndefined();
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

	it("selects a Relationship id from React Flow edge clicks", () => {
		const { runtimeStore } = renderCanvasNext({
			parsedSchema: usersAndOrders,
			tablePositions: {
				users: { x: 0, y: 0 },
				orders: { x: 300, y: 0 },
			},
		});

		act(() => {
			capturedOnEdgeClick?.(null as never, {
				id: "fk_orders_users:0",
				source: "orders",
				target: "users",
				type: "relationship",
				data: {},
			} as CanvasEdge);
		});

		expect(runtimeStore.getState().selectedRelationshipId).toBe(
			"fk_orders_users:0",
		);
	});

	it("replaces Relationship selection on a second edge click", () => {
		const { runtimeStore } = renderCanvasNext({
			parsedSchema: usersOrdersAndPayments,
			tablePositions: {
				users: { x: 0, y: 0 },
				orders: { x: 300, y: 0 },
				payments: { x: 600, y: 0 },
			},
		});

		act(() => {
			capturedOnEdgeClick?.(null as never, {
				id: "fk_orders_users:0",
				source: "orders",
				target: "users",
				type: "relationship",
				data: {},
			} as CanvasEdge);
			capturedOnEdgeClick?.(null as never, {
				id: "fk_payments_orders:0",
				source: "payments",
				target: "orders",
				type: "relationship",
				data: {},
			} as CanvasEdge);
		});

		expect(runtimeStore.getState().selectedRelationshipId).toBe(
			"fk_payments_orders:0",
		);
	});

	it("clears Relationship selection from React Flow pane clicks", () => {
		const { runtimeStore } = renderCanvasNext();

		act(() => {
			runtimeStore.getState().selectRelationship("fk_orders_users:0");
			capturedOnPaneClick?.(null as never);
		});

		expect(runtimeStore.getState().selectedRelationshipId).toBeNull();
	});

	it("clears stale Relationship selection after Parsed Schema replacement", () => {
		const { diagramStore, runtimeStore } = renderCanvasNext({
			parsedSchema: usersAndOrders,
			tablePositions: {
				users: { x: 0, y: 0 },
				orders: { x: 300, y: 0 },
			},
		});

		act(() => {
			runtimeStore.getState().selectRelationship("fk_orders_users:0");
			diagramStore.getState().replaceParsedSchema(usersOnly);
		});

		expect(runtimeStore.getState().selectedRelationshipId).toBeNull();
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
