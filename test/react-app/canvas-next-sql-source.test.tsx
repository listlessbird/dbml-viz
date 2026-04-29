import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { buildCanvasProjection } from "@/canvas-next/canvas-projection";
import { useSchemaParseFlow } from "@/canvas-next/use-schema-parse-flow";
import {
	DiagramSessionContext,
} from "@/diagram-session/diagram-session-context";
import {
	createDiagramSessionStore,
	type DiagramSessionStore,
} from "@/diagram-session/diagram-session-store";
import { parseSchemaSource as parseInWorkerModule } from "../../src/parser-worker/schema-source-parser";

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
});

const renderParseFlow = (store: DiagramSessionStore): void => {
	const Harness = ({ children }: { readonly children?: ReactNode }) => {
		useSchemaParseFlow({
			parser: async (source) => parseInWorkerModule(source),
		});
		return <>{children}</>;
	};

	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	act(() => {
		root!.render(
			<DiagramSessionContext value={store}>
				<Harness />
			</DiagramSessionContext>,
		);
	});
};

const flushMicrotasks = () => act(async () => {});

describe("Canvas Next SQL Source flow", () => {
	it("parses SQL Source and renders through the same Canvas Projection", async () => {
		const store = createDiagramSessionStore();
		renderParseFlow(store);

		act(() => {
			store.getState().setSchemaSource(`
				CREATE TABLE users (
					id int primary key
				);

				CREATE TABLE orders (
					id int primary key,
					user_id int references users(id)
				);
			`);
		});
		await flushMicrotasks();

		const state = store.getState();
		expect(state.sourceMetadata).toEqual({ format: "sql", dialect: "postgres" });
		expect(state.parseDiagnostics).toEqual([]);

		const projection = buildCanvasProjection(state.diagram, {
			activeRelationTableIds: [],
			temporaryRelationship: null,
		});

		expect(projection.nodes.map((node) => node.id).sort()).toEqual([
			"orders",
			"users",
		]);
		expect(projection.edges.map((edge) => edge.type)).toContain("relationship");
		expect(projection.edges.some((edge) => edge.source === "orders")).toBe(true);
	});

	it("preserves SQL Dialect selection behind the Schema Source Module", async () => {
		const store = createDiagramSessionStore();
		renderParseFlow(store);

		act(() => {
			store.getState().setSchemaSource(`
				CREATE TABLE users (
					id int primary key
				) ENGINE=InnoDB;
			`);
		});
		await flushMicrotasks();

		expect(store.getState().sourceMetadata).toEqual({
			format: "sql",
			dialect: "mysql",
		});
		expect(store.getState().diagram.parsedSchema.tables.map((table) => table.id)).toEqual([
			"users",
		]);
	});

	it("reports SQL Parse Diagnostics without destroying the last good Diagram", async () => {
		const store = createDiagramSessionStore();
		renderParseFlow(store);

		act(() => {
			store.getState().setSchemaSource("CREATE TABLE users (id int primary key);");
		});
		await flushMicrotasks();
		const lastGood = store.getState().diagram.parsedSchema;

		act(() => {
			store.getState().setSchemaSource("CREATE TABLE broken (");
		});
		await flushMicrotasks();

		expect(store.getState().diagram.parsedSchema).toBe(lastGood);
		expect(store.getState().parseDiagnostics.length).toBeGreaterThan(0);
	});
});
