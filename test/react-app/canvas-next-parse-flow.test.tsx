import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import {
	DiagramSessionContext,
} from "@/diagram-session/diagram-session-context";
import {
	createDiagramSessionStore,
	type DiagramSessionStore,
} from "@/diagram-session/diagram-session-store";
import { useSchemaParseFlow } from "@/canvas-next/use-schema-parse-flow";
import type { ParseSchemaSourceFn } from "@/schema-source/parse-schema-source";
import type { ParsedSchema } from "@/types";

const usersSchema: ParsedSchema = {
	tables: [{ id: "users", name: "users", columns: [], indexes: [] }],
	refs: [],
	errors: [],
};

const ordersOnly: ParsedSchema = {
	tables: [{ id: "orders", name: "orders", columns: [], indexes: [] }],
	refs: [],
	errors: [],
};

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

interface RenderOptions {
	readonly store: DiagramSessionStore;
	readonly parser: ParseSchemaSourceFn;
}

const renderWithStore = ({ store, parser }: RenderOptions): void => {
	const Harness = ({ children }: { readonly children?: ReactNode }) => {
		useSchemaParseFlow({ parser });
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

describe("Canvas Next parse flow", () => {
	it("parses Schema Source on change and applies the result through Diagram Session", async () => {
		const store = createDiagramSessionStore();
		renderWithStore({
			store,
			parser: async (source) => {
				expect(source).toBe("Table users {}");
				return { parsed: usersSchema, metadata: { format: "dbml" } };
			},
		});

		act(() => {
			store.getState().setSchemaSource("Table users {}");
		});
		await flushMicrotasks();

		expect(store.getState().diagram.parsedSchema).toEqual(usersSchema);
		expect(store.getState().parseDiagnostics).toEqual([]);
	});

	it("removes Table Positions for Tables that disappear from the new Parsed Schema", async () => {
		const store = createDiagramSessionStore();
		let nextSchema: ParsedSchema = usersSchema;

		renderWithStore({
			store,
			parser: async () => ({ parsed: nextSchema, metadata: { format: "dbml" } }),
		});

		act(() => {
			store.getState().setSchemaSource("Table users {}");
		});
		await flushMicrotasks();
		act(() => {
			store.getState().commitTablePositions({ users: { x: 1, y: 2 } });
		});

		nextSchema = ordersOnly;
		act(() => {
			store.getState().setSchemaSource("Table orders {}");
		});
		await flushMicrotasks();

		expect(store.getState().diagram.parsedSchema).toEqual(ordersOnly);
		expect(store.getState().diagram.tablePositions).toEqual({});
	});

	it("records diagnostics on parse failure without dropping the last good Parsed Schema", async () => {
		const store = createDiagramSessionStore();
		let shouldFail = false;

		renderWithStore({
			store,
			parser: async () => {
				if (shouldFail) {
					const { SchemaParseError } = await import("@/lib/parser-shared");
					throw new SchemaParseError([{ message: "bad" }]);
				}
				return { parsed: usersSchema, metadata: { format: "dbml" } };
			},
		});

		act(() => {
			store.getState().setSchemaSource("Table users {}");
		});
		await flushMicrotasks();

		shouldFail = true;
		act(() => {
			store.getState().setSchemaSource("Table {");
		});
		await flushMicrotasks();

		expect(store.getState().diagram.parsedSchema).toEqual(usersSchema);
		expect(store.getState().parseDiagnostics).toEqual([{ message: "bad" }]);
	});
});
