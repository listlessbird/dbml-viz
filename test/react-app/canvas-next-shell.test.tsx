import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, expect, it, vi, afterEach } from "vitest";

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

import App from "@/App";

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

const renderApp = () => {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);

	act(() => {
		root.render(<App />);
	});

	activeRoot = root;
	activeContainer = container;

	return container;
};

const waitForLazyEditor = async (container: HTMLDivElement) => {
	await vi.waitFor(() => {
		expect(
			container.querySelector('[data-testid="schema-source-editor"]'),
		).toBeTruthy();
	});
};

describe("canvas-next shell", () => {
	it("mounts and unmounts through the app route with explicit empty projection state", () => {
		const container = renderApp();

		const shell = container.querySelector('[data-testid="canvas-next-shell"]');
		const flow = container.querySelector('[data-testid="canvas-next-react-flow"]');

		expect(shell).toBeTruthy();
		expect(flow?.getAttribute("data-node-count")).toBe("0");
		expect(flow?.getAttribute("data-edge-count")).toBe("0");

		act(() => {
			activeRoot?.unmount();
		});
		activeRoot = null;
	});

	it("shows and hides the Schema Source editor without changing the Canvas", async () => {
		const container = renderApp();
		const toggle = container.querySelector<HTMLButtonElement>(
			'[data-testid="canvas-next-toggle-source-editor"]',
		);

		expect(toggle).toBeTruthy();
		act(() => {
			toggle?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		});
		await waitForLazyEditor(container);
		expect(
			container
				.querySelector('[data-testid="canvas-next-react-flow"]')
				?.getAttribute("data-node-count"),
		).toBe("0");

		const close = container.querySelector<HTMLButtonElement>(
			'[aria-label="Close schema source editor"]',
		);
		act(() => {
			close?.click();
		});

		expect(
			container.querySelector('[data-testid="schema-source-editor"]'),
		).toBeNull();
		expect(
			container
				.querySelector('[data-testid="canvas-next-react-flow"]')
				?.getAttribute("data-edge-count"),
		).toBe("0");
	});
});
