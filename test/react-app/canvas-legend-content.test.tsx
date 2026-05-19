import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { CanvasLegendContent } from "@/canvas-next/canvas-legend/canvas-legend-content";

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

describe("CanvasLegendContent", () => {
	it("renders glyph entries for the dbml-viz vocabulary", () => {
		activeContainer = document.createElement("div");
		document.body.appendChild(activeContainer);
		activeRoot = createRoot(activeContainer);
		act(() => {
			activeRoot?.render(<CanvasLegendContent />);
		});

		const list = activeContainer.querySelector(
			"[data-testid='canvas-legend-list']",
		);
		expect(list).not.toBeNull();
		const labels = Array.from(list!.querySelectorAll("p")).map(
			(node) => node.textContent ?? "",
		);
		expect(labels).toEqual(
			expect.arrayContaining([
				"Primary Key",
				"Foreign Key",
				"Indexed",
				"Unique",
				"Nullable",
				"Selected Relationship",
				"Search highlight",
			]),
		);
	});
});
