import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HotkeysProvider } from "@tanstack/react-hotkeys";

vi.mock("@xyflow/react", async () => {
	const React = await import("react");

	return {
		Background: () => React.createElement("div", { "data-testid": "background" }),
		BackgroundVariant: { Dots: "dots", Lines: "lines" },
		BaseEdge: () => React.createElement("div", { "data-testid": "base-edge" }),
		EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) =>
			React.createElement(React.Fragment, null, children),
		Handle: () => React.createElement("div", { "data-testid": "handle" }),
		MiniMap: ({ className }: { className?: string }) =>
			React.createElement("div", {
				"data-testid": "minimap",
				className,
			}),
		MarkerType: { ArrowClosed: "arrowclosed" },
		PanOnScrollMode: { Free: "free" },
		Position: { Left: "left", Right: "right" },
		ReactFlow: ({ children }: { children: React.ReactNode }) =>
			React.createElement("div", { "data-testid": "react-flow" }, children),
		SelectionMode: { Partial: "partial" },
		getSmoothStepPath: () => ["M0 0 L10 10"],
	};
});

import { Canvas } from "@/components/Canvas";

interface RenderCanvasResult {
	root: Root;
	container: HTMLDivElement;
}

const renderCanvas = (): RenderCanvasResult => {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);

	act(() => {
		root.render(
			<HotkeysProvider>
				<Canvas
					nodes={[]}
					edges={[]}
					gridMode="dots"
					isBusy={false}
					isLayouting={false}
					matchedTableNames={[]}
					zoom={1}
					onAutoLayout={vi.fn()}
					onNodesChange={vi.fn()}
					onEdgesChange={vi.fn()}
					onFitView={vi.fn()}
					onInit={vi.fn()}
					onViewportChange={vi.fn()}
					onZoomIn={vi.fn()}
					onZoomOut={vi.fn()}
				/>
			</HotkeysProvider>,
		);
	});

	return { root, container };
};

let activeRoot: Root | null = null;
let activeContainer: HTMLDivElement | null = null;

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
	}

	activeContainer?.remove();
	activeRoot = null;
	activeContainer = null;
});

describe("Canvas controls", () => {
	it("exposes explicit aria-labels on zoom and viewport controls", () => {
		const rendered = renderCanvas();
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		expect(rendered.container.querySelector('[aria-label="Zoom out"]')).toBeTruthy();
		expect(rendered.container.querySelector('[aria-label="Zoom in"]')).toBeTruthy();
		expect(rendered.container.querySelector('[aria-label="Fit view"]')).toBeTruthy();
		expect(
			rendered.container.querySelector('[aria-label="Toggle pan mode"]'),
		).toBeTruthy();
	});
});
