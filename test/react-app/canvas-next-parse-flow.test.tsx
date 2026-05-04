import { act, StrictMode, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	DiagramSessionContext,
} from "@/diagram-session/diagram-session-context";
import {
	createDiagramSessionStore,
	type DiagramSessionStore,
} from "@/diagram-session/diagram-session-store";
import { useSchemaParseFlow } from "@/canvas-next/use-schema-parse-flow";
import { createDiagramSessionWorkspacePatchApplier } from "@/workspace/workspace-store";
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
	vi.useRealTimers();
});

interface RenderOptions {
	readonly store: DiagramSessionStore;
	readonly parser: ParseSchemaSourceFn;
	readonly strict?: boolean;
}

const renderWithStore = ({ store, parser, strict = false }: RenderOptions): void => {
	const Harness = ({ children }: { readonly children?: ReactNode }) => {
		useSchemaParseFlow({ parser });
		return <>{children}</>;
	};

	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	const tree = (
		<DiagramSessionContext value={store}>
			<Harness />
		</DiagramSessionContext>
	);
	act(() => {
		root!.render(strict ? <StrictMode>{tree}</StrictMode> : tree);
	});
};

const flushMicrotasks = () => act(async () => {});

describe("Canvas Next parse flow", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

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
		act(() => {
			vi.advanceTimersByTime(300);
		});
		await flushMicrotasks();

		expect(store.getState().diagram.parsedSchema).toEqual(usersSchema);
		expect(store.getState().parseDiagnostics).toEqual([]);
	});

	it("routes Workspace source patches back through the parse flow", async () => {
		const store = createDiagramSessionStore();
		const applyWorkspacePatch = createDiagramSessionWorkspacePatchApplier(store);
		renderWithStore({
			store,
			parser: async (source) => {
				expect(source).toBe("Table users {}");
				return { parsed: usersSchema, metadata: { format: "dbml" } };
			},
		});

		act(() => {
			applyWorkspacePatch({ source: "Table users {}" });
		});
		act(() => {
			vi.advanceTimersByTime(300);
		});
		await flushMicrotasks();

		expect(store.getState().diagram.source).toBe("Table users {}");
		expect(store.getState().diagram.parsedSchema).toEqual(usersSchema);
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
		act(() => {
			vi.advanceTimersByTime(300);
		});
		await flushMicrotasks();
		act(() => {
			store.getState().commitTablePositions({ users: { x: 1, y: 2 } });
		});

		nextSchema = ordersOnly;
		act(() => {
			store.getState().setSchemaSource("Table orders {}");
		});
		act(() => {
			vi.advanceTimersByTime(300);
		});
		await flushMicrotasks();

		expect(store.getState().diagram.parsedSchema).toEqual(ordersOnly);
		expect(store.getState().diagram.tablePositions).toEqual({
			orders: expect.any(Object),
		});
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
		act(() => {
			vi.advanceTimersByTime(300);
		});
		await flushMicrotasks();

		shouldFail = true;
		act(() => {
			store.getState().setSchemaSource("Table {");
		});
		act(() => {
			vi.advanceTimersByTime(300);
		});
		await flushMicrotasks();

		expect(store.getState().diagram.parsedSchema).toEqual(usersSchema);
		expect(store.getState().parseDiagnostics).toEqual([{ message: "bad" }]);
	});

	it("debounces parser requests during rapid Schema Source edits", async () => {
		const store = createDiagramSessionStore();
		const parsedSources: string[] = [];

		renderWithStore({
			store,
			parser: async (source) => {
				parsedSources.push(source);
				return { parsed: usersSchema, metadata: { format: "dbml" } };
			},
		});

		act(() => {
			store.getState().setSchemaSource("Table u {}");
			vi.advanceTimersByTime(100);
			store.getState().setSchemaSource("Table us {}");
			vi.advanceTimersByTime(100);
			store.getState().setSchemaSource("Table users {}");
		});
		act(() => {
			vi.advanceTimersByTime(299);
		});
		await flushMicrotasks();

		expect(parsedSources).toEqual([]);

		act(() => {
			vi.advanceTimersByTime(1);
		});
		await flushMicrotasks();

		expect(parsedSources).toEqual(["Table users {}"]);
	});

	it("applies the parse result for the current Schema Source after the parse flow remounts", async () => {
		const store = createDiagramSessionStore({
			source: "Table users {}",
			parsedSchema: { tables: [], refs: [], errors: [] },
			tablePositions: {},
			stickyNotes: [],
		});
		renderWithStore({
			store,
			strict: true,
			parser: async () => ({ parsed: usersSchema, metadata: { format: "dbml" } }),
		});

		act(() => {
			vi.advanceTimersByTime(300);
		});
		await flushMicrotasks();
		await flushMicrotasks();

		expect(store.getState().diagram.parsedSchema).toEqual(usersSchema);
	});

	it("drops stale parser responses when a newer generation finishes first", async () => {
		const store = createDiagramSessionStore();
		const resolvers: Array<(schema: ParsedSchema) => void> = [];

		renderWithStore({
			store,
			parser: (source) =>
				new Promise((resolve) => {
					resolvers.push((schema) =>
						resolve({ parsed: schema, metadata: { format: "dbml" } }),
					);
					expect(source.length).toBeGreaterThan(0);
				}),
		});

		act(() => {
			store.getState().setSchemaSource("Table users {}");
		});
		act(() => {
			vi.advanceTimersByTime(300);
		});
		await flushMicrotasks();

		act(() => {
			store.getState().setSchemaSource("Table orders {}");
		});
		act(() => {
			vi.advanceTimersByTime(300);
		});
		await flushMicrotasks();

		act(() => {
			resolvers[1]?.(ordersOnly);
		});
		await flushMicrotasks();
		await flushMicrotasks();

		act(() => {
			resolvers[0]?.(usersSchema);
		});
		await flushMicrotasks();
		await flushMicrotasks();

		expect(store.getState().diagram.parsedSchema).toEqual(ordersOnly);
	});
});
