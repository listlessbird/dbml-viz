import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DraftPersistenceProvider } from "@/canvas-next/diagram-persistence-context";
import type { DraftPersistenceAdapter } from "@/canvas-next/diagram-persistence-adapter";
import { useDraftPersistence } from "@/canvas-next/use-draft-persistence";
import {
	DiagramSessionContext,
	type Diagram,
} from "@/diagram-session/diagram-session-context";
import {
	createDiagramSessionStore,
	type DiagramSessionStore,
} from "@/diagram-session/diagram-session-store";
import { SAMPLE_SCHEMA_SOURCE } from "@/lib/sample-dbml";
import type { SchemaPayload } from "@/types";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function createFakeAdapter(): DraftPersistenceAdapter & {
	readonly drafts: Map<string, SchemaPayload>;
	readonly cleared: Set<string>;
} {
	const drafts = new Map<string, SchemaPayload>();
	const cleared = new Set<string>();
	return {
		drafts,
		cleared,
		getDraft: (shareId) => drafts.get(shareId ?? "root") ?? null,
		setDraft: (shareId, payload) => {
			drafts.set(shareId ?? "root", payload);
			cleared.delete(shareId ?? "root");
		},
		clearDraft: (shareId) => {
			drafts.delete(shareId ?? "root");
			cleared.add(shareId ?? "root");
		},
	};
}

function Bridge() {
	useDraftPersistence();
	return null;
}

function renderWith(store: DiagramSessionStore, adapter: DraftPersistenceAdapter) {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	act(() => {
		root?.render(
			<DiagramSessionContext value={store}>
				<DraftPersistenceProvider adapter={adapter}>
					<Bridge />
				</DraftPersistenceProvider>
			</DiagramSessionContext>,
		);
	});
}

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

const initialDiagram: Diagram = {
	source: "Table users { id int }",
	parsedSchema: { tables: [], refs: [], errors: [] },
	tablePositions: {},
	stickyNotes: [],
};

describe("useDraftPersistence", () => {
	it("debounces and saves a Schema Payload after a source change", () => {
		const store = createDiagramSessionStore(initialDiagram);
		const adapter = createFakeAdapter();
		renderWith(store, adapter);

		act(() => {
			store.getState().setSchemaSource("Table edited { id int }");
		});

		expect(adapter.drafts.has("root")).toBe(false);

		act(() => {
			vi.advanceTimersByTime(500);
		});

		const saved = adapter.drafts.get("root");
		expect(saved?.source).toBe("Table edited { id int }");
		expect(saved?.version).toBe(3);
	});

	it("clears the draft when the payload matches the sample baseline", () => {
		const sampleStart: Diagram = {
			source: "Table edited { id int }",
			parsedSchema: { tables: [], refs: [], errors: [] },
			tablePositions: {},
			stickyNotes: [],
		};
		const store = createDiagramSessionStore(sampleStart);
		const adapter = createFakeAdapter();
		adapter.setDraft(null, {
			source: "Table edited { id int }",
			positions: {},
			notes: [],
			version: 3,
		});
		adapter.cleared.clear();

		renderWith(store, adapter);

		act(() => {
			store.getState().setSchemaSource(SAMPLE_SCHEMA_SOURCE);
		});
		act(() => {
			vi.advanceTimersByTime(500);
		});

		expect(adapter.cleared.has("root")).toBe(true);
		expect(adapter.drafts.has("root")).toBe(false);
	});
});
