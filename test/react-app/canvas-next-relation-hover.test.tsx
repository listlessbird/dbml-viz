import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { CanvasRuntimeContext } from "@/canvas-next/canvas-runtime-context";
import {
	createCanvasRuntimeStore,
	type CanvasRuntimeStore,
} from "@/canvas-next/canvas-runtime-store";
import {
	useRelationHoverHandlers,
	type RelationHoverHandlers,
} from "@/canvas-next/use-relation-hover";
import type { CanvasNode } from "@/types";

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

const renderHandlers = (
	store: CanvasRuntimeStore,
	captured: { current: RelationHoverHandlers | null },
) => {
	const Harness = () => {
		const handlers = useRelationHoverHandlers();
		useEffect(() => {
			captured.current = handlers;
		}, [handlers]);
		return null;
	};

	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	act(() => {
		root!.render(
			<CanvasRuntimeContext value={store}>
				<Harness />
			</CanvasRuntimeContext>,
		);
	});
};

const makeTableNode = (id: string): CanvasNode =>
	({
		id,
		type: "table",
		position: { x: 0, y: 0 },
		data: {
			table: { id, name: id, columns: [], indexes: [] },
			layout: { width: 0, height: 0, typeColumnWidth: 0 },
			accent: "var(--chart-1)",
			connectedColumns: [],
			isSearchMatch: false,
			isSearchRelated: false,
			isSearchDimmed: false,
			relationAnchors: [],
			compositeHandleOffsets: {},
		},
	}) as unknown as CanvasNode;

describe("useRelationHoverHandlers", () => {
	it("sets Active Relation Table Ids on Table mouse-enter", () => {
		const store = createCanvasRuntimeStore();
		const captured: { current: RelationHoverHandlers | null } = { current: null };
		renderHandlers(store, captured);

		const handlers = captured.current as RelationHoverHandlers;
		act(() => {
			handlers.onNodeMouseEnter(null, makeTableNode("orders"));
		});

		expect(store.getState().activeRelationTableIds).toEqual(["orders"]);
	});

	it("clears Active Relation Table Ids on Table mouse-leave", () => {
		const store = createCanvasRuntimeStore();
		const captured: { current: RelationHoverHandlers | null } = { current: null };
		renderHandlers(store, captured);

		const handlers = captured.current as RelationHoverHandlers;
		act(() => {
			handlers.onNodeMouseEnter(null, makeTableNode("orders"));
		});
		act(() => {
			handlers.onNodeMouseLeave(null, makeTableNode("orders"));
		});

		expect(store.getState().activeRelationTableIds).toEqual([]);
	});

	it("ignores non-Table nodes such as sticky notes and temporary cursor", () => {
		const store = createCanvasRuntimeStore();
		const captured: { current: RelationHoverHandlers | null } = { current: null };
		renderHandlers(store, captured);

		const handlers = captured.current as RelationHoverHandlers;
		const stickyNode = {
			id: "note-1",
			type: "sticky",
			position: { x: 0, y: 0 },
			data: {},
		} as unknown as CanvasNode;
		act(() => {
			handlers.onNodeMouseEnter(null, stickyNode);
		});
		expect(store.getState().activeRelationTableIds).toEqual([]);
	});
});
