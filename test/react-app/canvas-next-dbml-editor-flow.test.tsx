import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ParseResult } from "@/schema-source/parse-schema-source";
import type { ParsedSchema } from "@/types";

const column = (name: string) => ({
	name,
	type: "int",
	pk: name === "id",
	notNull: name === "id",
	unique: false,
	isForeignKey: name.endsWith("_id"),
	isIndexed: name.endsWith("_id"),
});

const usersOnly: ParsedSchema = {
	tables: [
		{ id: "users", name: "users", columns: [column("id")], indexes: [] },
	],
	refs: [],
	errors: [],
};

const usersAndOrders: ParsedSchema = {
	tables: [
		{ id: "users", name: "users", columns: [column("id")], indexes: [] },
		{
			id: "orders",
			name: "orders",
			columns: [column("id"), column("user_id")],
			indexes: [],
		},
	],
	refs: [
		{
			id: "orders_user_id_fk",
			from: { table: "orders", columns: ["user_id"] },
			to: { table: "users", columns: ["id"] },
			type: "many_to_one",
		},
	],
	errors: [],
};

vi.mock("@/schema-source/parse-schema-source", () => ({
	parseSchemaSource: vi.fn(
		async (source: string): Promise<ParseResult> => {
			if (source.includes("broken")) {
				return {
					ok: false,
					diagnostics: [
						{
							message: "Expected table body",
							location: { start: { line: 1, column: 13 } },
						},
					],
				};
			}

			return {
				ok: true,
				parsedSchema: source.includes("orders") ? usersAndOrders : usersOnly,
				metadata: { format: "dbml" },
			};
		},
	),
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
				},
				children,
			),
	};
});

import { CanvasRuntimeContext } from "@/canvas-next/canvas-runtime-context";
import { createCanvasRuntimeStore } from "@/canvas-next/canvas-runtime-store";
import { CanvasNextCanvas } from "@/canvas-next/canvas";
import { DiagramSessionContext } from "@/diagram-session/diagram-session-context";
import { createDiagramSessionStore } from "@/diagram-session/diagram-session-store";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	if (root) {
		act(() => {
			root?.unmount();
		});
	}
	container?.remove();
	root = null;
	container = null;
	vi.useRealTimers();
});

const flushMicrotasks = () => act(async () => {});

describe("Canvas Next DBML editor flow", () => {
	it("updates the Canvas after a durable DBML edit succeeds", async () => {
		const diagramStore = createDiagramSessionStore({
			source: "",
			parsedSchema: usersAndOrders,
			tablePositions: {
				users: { x: 10, y: 20 },
				orders: { x: 220, y: 20 },
			},
			stickyNotes: [],
		});
		const runtimeStore = createCanvasRuntimeStore();

		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		act(() => {
			root?.render(
				<DiagramSessionContext value={diagramStore}>
					<CanvasRuntimeContext value={runtimeStore}>
						<CanvasNextCanvas />
					</CanvasRuntimeContext>
				</DiagramSessionContext>,
			);
		});

		expect(
			container
				.querySelector('[data-testid="canvas-next-react-flow"]')
				?.getAttribute("data-node-count"),
		).toBe("2");
		expect(
			container
				.querySelector('[data-testid="canvas-next-react-flow"]')
				?.getAttribute("data-edge-count"),
		).toBe("1");

		act(() => {
			diagramStore.getState().setSchemaSource("Table users { id int [pk] }");
		});
		act(() => {
			vi.advanceTimersByTime(300);
		});
		await flushMicrotasks();
		await flushMicrotasks();

		expect(
			container
				.querySelector('[data-testid="canvas-next-react-flow"]')
				?.getAttribute("data-node-count"),
		).toBe("1");
		expect(
			container
				.querySelector('[data-testid="canvas-next-react-flow"]')
				?.getAttribute("data-edge-count"),
		).toBe("0");
		expect(diagramStore.getState().diagram.tablePositions).toEqual({
			users: { x: 10, y: 20 },
		});
	});

	it("keeps the Canvas on the last good Parsed Schema after a failed edit", async () => {
		const diagramStore = createDiagramSessionStore({
			source: "",
			parsedSchema: usersOnly,
			tablePositions: { users: { x: 10, y: 20 } },
			stickyNotes: [],
		});
		const runtimeStore = createCanvasRuntimeStore();

		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		act(() => {
			root?.render(
				<DiagramSessionContext value={diagramStore}>
					<CanvasRuntimeContext value={runtimeStore}>
						<CanvasNextCanvas />
					</CanvasRuntimeContext>
				</DiagramSessionContext>,
			);
		});

		act(() => {
			diagramStore.getState().setSchemaSource("Table broken {");
		});
		act(() => {
			vi.advanceTimersByTime(300);
		});
		await flushMicrotasks();
		await flushMicrotasks();

		expect(
			container
				.querySelector('[data-testid="canvas-next-react-flow"]')
				?.getAttribute("data-node-count"),
		).toBe("1");
		expect(diagramStore.getState().diagram.parsedSchema).toBe(usersOnly);
		expect(diagramStore.getState().diagram.tablePositions).toEqual({
			users: { x: 10, y: 20 },
		});
		expect(diagramStore.getState().parseDiagnostics).toEqual([
			{
				message: "Expected table body",
				location: { start: { line: 1, column: 13 } },
			},
		]);
	});
});
