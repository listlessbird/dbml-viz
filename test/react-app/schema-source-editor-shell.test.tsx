import { act } from "react";
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

	it("reuses DBML language support through the language Adapter", async () => {
		const first = loadEditorLanguage({ format: "dbml" });
		const second = loadEditorLanguage({ format: "dbml" });

		expect(second).toBe(first);
		expect(await second).toBe(await first);
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
