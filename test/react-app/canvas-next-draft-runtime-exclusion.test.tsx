import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CanvasRuntimeContext } from "@/canvas-next/canvas-runtime-context";
import { createCanvasRuntimeStore } from "@/canvas-next/canvas-runtime-store";
import type { DraftPersistenceAdapter } from "@/canvas-next/diagram-persistence-adapter";
import { DraftPersistenceProvider } from "@/canvas-next/diagram-persistence-context";
import { useDraftPersistence } from "@/canvas-next/use-draft-persistence";
import {
	DiagramSessionContext,
	type Diagram,
} from "@/diagram-session/diagram-session-context";
import { createDiagramSessionStore } from "@/diagram-session/diagram-session-store";
import { EMPTY_SCHEMA_SEARCH_RESULT } from "@/schema-model/schema-search";
import type { SchemaPayload } from "@/types";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const initialDiagram: Diagram = {
	source: "Table users { id int }",
	parsedSchema: { tables: [], refs: [], errors: [] },
	tablePositions: { users: { x: 1, y: 2 } },
	stickyNotes: [],
};

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

function Bridge() {
	useDraftPersistence();
	return null;
}

describe("Draft persistence excludes Canvas Runtime", () => {
	it("does not save a draft when only Canvas Runtime state changes", () => {
		const sessionStore = createDiagramSessionStore(initialDiagram);
		const runtimeStore = createCanvasRuntimeStore();
		const saved: SchemaPayload[] = [];
		const adapter: DraftPersistenceAdapter = {
			getDraft: () => null,
			setDraft: (_id, payload) => saved.push(payload),
			clearDraft: () => {},
		};

		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		act(() => {
			root?.render(
				<DiagramSessionContext value={sessionStore}>
					<CanvasRuntimeContext value={runtimeStore}>
						<DraftPersistenceProvider adapter={adapter}>
							<Bridge />
						</DraftPersistenceProvider>
					</CanvasRuntimeContext>
				</DiagramSessionContext>,
			);
		});

		act(() => {
			runtimeStore.getState().setViewport({ x: 50, y: 75, zoom: 2 });
			runtimeStore.getState().requestFocus(["users"]);
			runtimeStore.getState().setSearchHighlight({
				...EMPTY_SCHEMA_SEARCH_RESULT,
				matchedTableIds: ["users"],
			});
		});
		act(() => {
			vi.advanceTimersByTime(500);
		});

		expect(saved).toHaveLength(0);
	});

	it("saved payload only contains Schema Payload fields", () => {
		const sessionStore = createDiagramSessionStore(initialDiagram);
		const saved: SchemaPayload[] = [];
		const adapter: DraftPersistenceAdapter = {
			getDraft: () => null,
			setDraft: (_id, payload) => saved.push(payload),
			clearDraft: () => {},
		};

		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		act(() => {
			root?.render(
				<DiagramSessionContext value={sessionStore}>
					<DraftPersistenceProvider adapter={adapter}>
						<Bridge />
					</DraftPersistenceProvider>
				</DiagramSessionContext>,
			);
		});

		act(() => {
			sessionStore.getState().setSchemaSource("Table edited { id int }");
		});
		act(() => {
			vi.advanceTimersByTime(500);
		});

		expect(saved).toHaveLength(1);
		expect(Object.keys(saved[0]).sort()).toEqual([
			"notes",
			"positions",
			"source",
			"version",
		]);
	});
});
