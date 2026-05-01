import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@xyflow/react", async () => {
	const React = await import("react");

	return {
		Background: () => React.createElement("div", { "data-testid": "background" }),
		BackgroundVariant: { Dots: "dots" },
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

import { CanvasNextPage } from "@/canvas-next/canvas-page";
import type { DraftPersistenceAdapter } from "@/canvas-next/diagram-persistence-adapter";
import type { SchemaPayload } from "@/types";

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

describe("CanvasNextPage draft hydration", () => {
	it("reads the draft once on mount and feeds it into the Diagram Session", () => {
		const draft: SchemaPayload = {
			source: "Table hydrated_table { id int }",
			positions: { hydrated_table: { x: 11, y: 22 } },
			notes: [],
			version: 3,
		};
		const getDraftCalls: (string | null)[] = [];
		const fakeAdapter: DraftPersistenceAdapter = {
			getDraft: (shareId) => {
				getDraftCalls.push(shareId);
				return draft;
			},
			setDraft: () => {},
			clearDraft: () => {},
		};

		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		act(() => {
			root?.render(<CanvasNextPage adapter={fakeAdapter} />);
		});

		expect(getDraftCalls).toEqual([null]);
		expect(
			container.querySelector('[data-testid="canvas-next-react-flow"]'),
		).toBeTruthy();
	});
});
