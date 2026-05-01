import { act, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { CanvasRuntimeContext } from "@/canvas-next/canvas-runtime-context";
import {
	createCanvasRuntimeStore,
	type CanvasRuntimeStore,
} from "@/canvas-next/canvas-runtime-store";
import { useCanvasSearchEmphasis } from "@/canvas-next/use-canvas-search-emphasis";
import {
	DiagramSessionContext,
} from "@/diagram-session/diagram-session-context";
import {
	createDiagramSessionStore,
	type DiagramSessionStore,
} from "@/diagram-session/diagram-session-store";
import type { ParsedSchema } from "@/types";

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

const sampleSchema: ParsedSchema = {
	tables: [
		{ id: "users", name: "users", columns: [], indexes: [] },
		{ id: "orders", name: "orders", columns: [], indexes: [] },
		{ id: "products", name: "products", columns: [], indexes: [] },
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

interface HarnessHandles {
	setQuery: (q: string) => void;
	clear: () => void;
	focusMatched: () => void;
	getMatchedNames: () => readonly string[];
}

const renderHarness = (
	sessionStore: DiagramSessionStore,
	runtimeStore: CanvasRuntimeStore,
): HarnessHandles => {
	const handles: Partial<HarnessHandles> = {};

	const Harness = () => {
		const [query, setQuery] = useState("");
		const emphasis = useCanvasSearchEmphasis(query);
		useEffect(() => {
			handles.setQuery = (next) => setQuery(next);
			handles.clear = () => setQuery("");
			handles.focusMatched = emphasis.focusMatched;
			handles.getMatchedNames = () => emphasis.matchedTableNames;
		});
		return null;
	};

	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	act(() => {
		root!.render(
			<DiagramSessionContext value={sessionStore}>
				<CanvasRuntimeContext value={runtimeStore}>
					<Harness />
				</CanvasRuntimeContext>
			</DiagramSessionContext>,
		);
	});

	return handles as HarnessHandles;
};

describe("useCanvasSearchEmphasis", () => {
	it("writes Search Highlight to Canvas Runtime when the query matches Tables", () => {
		const sessionStore = createDiagramSessionStore();
		sessionStore.getState().replaceParsedSchema(sampleSchema);
		const runtimeStore = createCanvasRuntimeStore();

		const handles = renderHarness(sessionStore, runtimeStore);
		act(() => handles.setQuery("user"));

		expect(runtimeStore.getState().searchHighlight).toEqual({
			matchedTableIds: ["users"],
			relatedTableIds: ["orders"],
			highlightedEdgeIds: ["fk_orders_users:0"],
		});
		expect(handles.getMatchedNames()).toEqual(["users"]);
	});

	it("clears Canvas Runtime Search Highlight when the query becomes empty", () => {
		const sessionStore = createDiagramSessionStore();
		sessionStore.getState().replaceParsedSchema(sampleSchema);
		const runtimeStore = createCanvasRuntimeStore();
		const handles = renderHarness(sessionStore, runtimeStore);

		act(() => handles.setQuery("user"));
		expect(runtimeStore.getState().searchHighlight).not.toBeNull();

		act(() => handles.clear());
		expect(runtimeStore.getState().searchHighlight).toBeNull();
	});

	it("does not mutate Diagram state while highlighting", () => {
		const sessionStore = createDiagramSessionStore();
		sessionStore.getState().replaceParsedSchema(sampleSchema);
		const runtimeStore = createCanvasRuntimeStore();
		const beforeDiagram = sessionStore.getState().diagram;

		const handles = renderHarness(sessionStore, runtimeStore);
		act(() => handles.setQuery("orders"));
		act(() => handles.clear());

		expect(sessionStore.getState().diagram).toBe(beforeDiagram);
	});

	it("focusMatched issues a Focus command for the matched Table ids", () => {
		const sessionStore = createDiagramSessionStore();
		sessionStore.getState().replaceParsedSchema(sampleSchema);
		const runtimeStore = createCanvasRuntimeStore();
		const handles = renderHarness(sessionStore, runtimeStore);

		act(() => handles.setQuery("orders"));
		act(() => {
			handles.focusMatched();
		});

		expect(runtimeStore.getState().focusTableIds).toEqual(["orders"]);
	});

	it("clears Canvas Runtime Search Highlight on unmount so emphasis does not leak", () => {
		const sessionStore = createDiagramSessionStore();
		sessionStore.getState().replaceParsedSchema(sampleSchema);
		const runtimeStore = createCanvasRuntimeStore();
		const handles = renderHarness(sessionStore, runtimeStore);

		act(() => handles.setQuery("user"));
		expect(runtimeStore.getState().searchHighlight).not.toBeNull();

		act(() => {
			root?.unmount();
		});
		root = null;

		expect(runtimeStore.getState().searchHighlight).toBeNull();
	});
});
