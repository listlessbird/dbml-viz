import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HotkeysProvider } from "@tanstack/react-hotkeys";

import { CanvasDock } from "@/components/CanvasDock";
import { useDiagramUiStore } from "@/store/useDiagramUiStore";

interface RenderDockResult {
	root: Root;
	container: HTMLDivElement;
}

const renderDock = (): RenderDockResult => {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);

	act(() => {
		root.render(
			<HotkeysProvider>
				<CanvasDock
					isLayouting={false}
					matchedTableNames={["users", "orders"]}
					onAutoLayout={vi.fn()}
					onFitView={vi.fn()}
					onZoomIn={vi.fn()}
					onZoomOut={vi.fn()}
						onAddStickyNote={vi.fn()}
				/>
			</HotkeysProvider>,
		);
	});

	return { root, container };
};

const dispatchHotkey = async (
	key: string,
	target: Document | HTMLElement = document,
) => {
	const event = new KeyboardEvent("keydown", {
		key,
		bubbles: true,
		cancelable: true,
	});

	await act(async () => {
		target.dispatchEvent(event);
		await Promise.resolve();
	});

	return event;
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

describe("CanvasDock hotkeys", () => {
	it("only applies numbered layout shortcuts while arrange is open", async () => {
		const onAutoLayout = vi.fn();
		const container = document.createElement("div");
		document.body.appendChild(container);
		const root = createRoot(container);
		activeRoot = root;
		activeContainer = container;

		act(() => {
			root.render(
				<HotkeysProvider>
					<CanvasDock
						isLayouting={false}
						matchedTableNames={["users"]}
						onAutoLayout={onAutoLayout}
						onFitView={vi.fn()}
						onZoomIn={vi.fn()}
						onZoomOut={vi.fn()}
						onAddStickyNote={vi.fn()}
					/>
				</HotkeysProvider>,
			);
		});

		await dispatchHotkey("2");
		expect(onAutoLayout).not.toHaveBeenCalled();
		expect(useDiagramUiStore.getState().layoutAlgorithm).toBe("left-right");

		await dispatchHotkey("l");
		await dispatchHotkey("2");

		expect(onAutoLayout).toHaveBeenCalledTimes(1);
		expect(onAutoLayout).toHaveBeenCalledWith("snowflake");
		expect(useDiagramUiStore.getState().layoutAlgorithm).toBe("snowflake");
	});

	it("opens search on slash and focuses the search input", async () => {
		const rendered = renderDock();
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		const editorSurface = document.createElement("div");
		editorSurface.contentEditable = "true";
		document.body.appendChild(editorSurface);
		editorSurface.focus();

		const event = await dispatchHotkey("/", editorSurface);

		const searchInput = document.getElementById("table-search");
		expect(event.defaultPrevented).toBe(true);
		expect(searchInput).toBeInstanceOf(HTMLInputElement);
		expect(searchInput?.getAttribute("aria-label")).toBe("Search tables");
		expect(document.activeElement).toBe(searchInput);
		editorSurface.remove();
	});

	it("exposes explicit aria-labels on dock controls", () => {
		const rendered = renderDock();
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		expect(rendered.container.querySelector('[aria-label="Canvas grid"]')).toBeTruthy();
		expect(
			rendered.container.querySelector('[aria-label="Arrange diagram"]'),
		).toBeTruthy();
		expect(rendered.container.querySelector('[aria-label="Search tables"]')).toBeTruthy();
	});

	it("routes viewport hotkeys to the dock callbacks", async () => {
		const onFitView = vi.fn();
		const onZoomIn = vi.fn();
		const onZoomOut = vi.fn();
		const container = document.createElement("div");
		document.body.appendChild(container);
		const root = createRoot(container);
		activeRoot = root;
		activeContainer = container;

		act(() => {
			root.render(
				<HotkeysProvider>
					<CanvasDock
						isLayouting={false}
						matchedTableNames={[]}
						onAutoLayout={vi.fn()}
						onFitView={onFitView}
						onZoomIn={onZoomIn}
						onZoomOut={onZoomOut}
						onAddStickyNote={vi.fn()}
					/>
				</HotkeysProvider>,
			);
		});

		await dispatchHotkey("-");
		await dispatchHotkey("=");
		await dispatchHotkey("0");
		await dispatchHotkey("p");

		expect(onZoomOut).toHaveBeenCalledTimes(1);
		expect(onZoomIn).toHaveBeenCalledTimes(1);
		expect(onFitView).toHaveBeenCalledTimes(1);
		expect(useDiagramUiStore.getState().panModeEnabled).toBe(true);
	});
});
