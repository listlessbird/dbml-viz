import { act } from "react";
import { EditorView } from "@codemirror/view";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { DiagramSessionContext } from "@/diagram-session/diagram-session-context";
import { createDiagramSessionStore } from "@/diagram-session/diagram-session-store";
import { loadEditorLanguage } from "@/lib/editor-language";
import { SchemaSourceEditorPanel } from "@/schema-source-editor/schema-source-editor";

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

const flushMicrotasks = () => act(async () => {});

describe("Schema Source Editor shell", () => {
	it("renders durable Schema Source from Diagram Session", async () => {
		const sessionStore = createDiagramSessionStore({
			source: "Table users {\n  id int [pk]\n}",
			parsedSchema: { tables: [], refs: [], errors: [] },
			tablePositions: {},
			stickyNotes: [],
		});

		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		act(() => {
			root?.render(
				<DiagramSessionContext value={sessionStore}>
					<SchemaSourceEditorPanel />
				</DiagramSessionContext>,
			);
		});
		await flushMicrotasks();

		expect(
			container.querySelector('[data-testid="schema-source-editor"]'),
		).toBeTruthy();
		expect(container.textContent).toContain("Table users");
		expect(container.textContent).toContain("id int");
	});

	it("commits editor text edits through Diagram Session", async () => {
		const sessionStore = createDiagramSessionStore();

		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		act(() => {
			root?.render(
				<DiagramSessionContext value={sessionStore}>
					<SchemaSourceEditorPanel />
				</DiagramSessionContext>,
			);
		});
		await flushMicrotasks();

		const editorContent = container.querySelector<HTMLElement>(".cm-content");
		expect(editorContent).toBeTruthy();
		const view = editorContent ? EditorView.findFromDOM(editorContent) : null;
		expect(view).toBeTruthy();
		act(() => {
			view?.dispatch({
				changes: { from: 0, insert: "Table users {}" },
			});
		});
		await flushMicrotasks();

		expect(sessionStore.getState().diagram.source).toBe("Table users {}");
	});

	it("switches source metadata to SQL without remounting the editor view", async () => {
		const sessionStore = createDiagramSessionStore({
			source: "CREATE TABLE users (id int primary key);",
			parsedSchema: { tables: [], refs: [], errors: [] },
			tablePositions: {},
			stickyNotes: [],
		});

		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		act(() => {
			root?.render(
				<DiagramSessionContext value={sessionStore}>
					<SchemaSourceEditorPanel />
				</DiagramSessionContext>,
			);
		});
		await flushMicrotasks();

		const editorContent = container.querySelector<HTMLElement>(".cm-content");
		const initialView = editorContent
			? EditorView.findFromDOM(editorContent)
			: null;
		const sqlButton = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent === "SQL",
		);

		act(() => {
			sqlButton?.click();
		});
		await flushMicrotasks();

		const currentView = editorContent
			? EditorView.findFromDOM(editorContent)
			: null;
		expect(currentView).toBe(initialView);
		expect(sessionStore.getState().sourceMetadata).toEqual({
			format: "sql",
			dialect: "postgres",
		});
		const visibleDialectSelect = container.querySelector(
			'[aria-label="SQL dialect"]',
		) as HTMLSelectElement | null;
		expect(visibleDialectSelect?.value).toBe("postgres");
	});

	it("updates SQL dialect metadata from the editor controls", async () => {
		const sessionStore = createDiagramSessionStore();

		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		act(() => {
			root?.render(
				<DiagramSessionContext value={sessionStore}>
					<SchemaSourceEditorPanel />
				</DiagramSessionContext>,
			);
		});
		await flushMicrotasks();

		act(() => {
			sessionStore.getState().setSourceMetadata({
				format: "sql",
				dialect: "postgres",
			});
		});
		await flushMicrotasks();

		const dialectSelect = container.querySelector(
			'[aria-label="SQL dialect"]',
		) as HTMLSelectElement | null;
		expect(dialectSelect).toBeTruthy();
		act(() => {
			if (!dialectSelect) return;
			dialectSelect.value = "mysql";
			dialectSelect.dispatchEvent(new Event("change", { bubbles: true }));
		});

		expect(sessionStore.getState().sourceMetadata).toEqual({
			format: "sql",
			dialect: "mysql",
		});
	});

	it("reuses DBML language support through the language Adapter", async () => {
		const first = loadEditorLanguage({ format: "dbml" });
		const second = loadEditorLanguage({ format: "dbml" });

		expect(second).toBe(first);
		expect(await second).toBe(await first);
	});

	it("renders diagnostics from plain Diagram Session data and clears them on success", async () => {
		const sessionStore = createDiagramSessionStore({
			source: "Table users {\n  id int [pk]\n",
			parsedSchema: { tables: [], refs: [], errors: [] },
			tablePositions: {},
			stickyNotes: [],
		});

		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		act(() => {
			root?.render(
				<DiagramSessionContext value={sessionStore}>
					<SchemaSourceEditorPanel />
				</DiagramSessionContext>,
			);
		});
		await flushMicrotasks();

		act(() => {
			sessionStore.getState().applyParseResult({
				ok: false,
				diagnostics: [
					{
						message: "Expected closing brace",
						location: {
							start: { line: 2, column: 3 },
							end: { line: 2, column: 5 },
						},
					},
				],
			});
		});
		await flushMicrotasks();

		expect(
			container.querySelector('[data-testid="schema-source-diagnostics"]')
				?.textContent,
		).toContain("Line 2, column 3");
		expect(container.textContent).toContain("Expected closing brace");
		expect(container.querySelector(".cm-parse-error-line")).toBeTruthy();
		expect(container.querySelector(".cm-parse-error-range")).toBeTruthy();

		act(() => {
			sessionStore.getState().applyParseResult({
				ok: true,
				parsedSchema: { tables: [], refs: [], errors: [] },
				metadata: { format: "dbml" },
			});
		});
		await flushMicrotasks();

		expect(
			container.querySelector('[data-testid="schema-source-diagnostics"]'),
		).toBeNull();
		expect(container.querySelector(".cm-parse-error-line")).toBeNull();
		expect(container.querySelector(".cm-parse-error-range")).toBeNull();
	});

	it("summarizes diagnostics without source ranges", async () => {
		const sessionStore = createDiagramSessionStore();

		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		act(() => {
			root?.render(
				<DiagramSessionContext value={sessionStore}>
					<SchemaSourceEditorPanel />
				</DiagramSessionContext>,
			);
		});
		await flushMicrotasks();

		act(() => {
			sessionStore.getState().applyParseResult({
				ok: false,
				diagnostics: [{ message: "Unable to parse source" }],
			});
		});
		await flushMicrotasks();

		const summary = container.querySelector(
			'[data-testid="schema-source-diagnostics"]',
		);
		expect(summary?.textContent).toContain("Source");
		expect(summary?.textContent).toContain("Unable to parse source");
		expect(container.querySelector(".cm-parse-error-line")).toBeNull();
	});

	it("unmounts without mutating durable Diagram state", async () => {
		const initialDiagram = {
			source: "Table accounts {\n  id int [pk]\n}",
			parsedSchema: { tables: [], refs: [], errors: [] },
			tablePositions: { accounts: { x: 20, y: 30 } },
			stickyNotes: [],
		};
		const sessionStore = createDiagramSessionStore(initialDiagram);

		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		act(() => {
			root?.render(
				<DiagramSessionContext value={sessionStore}>
					<SchemaSourceEditorPanel />
				</DiagramSessionContext>,
			);
		});
		await flushMicrotasks();

		const before = sessionStore.getState().toSchemaPayload();
		act(() => {
			root?.unmount();
		});
		root = null;

		expect(sessionStore.getState().toSchemaPayload()).toEqual(before);
	});
});
