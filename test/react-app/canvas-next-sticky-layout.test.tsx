import { act, useEffect } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import {
	useStickyLayout,
	type StickyLayoutInput,
	type StickyLayoutOutput,
} from "@/canvas-next/sticky-note/use-sticky-layout";
import {
	STICKY_NOTE_MIN_HEIGHT,
	STICKY_NOTE_MIN_WIDTH,
} from "@/canvas-next/sticky-note/measure";

const isAnyValid = () => true;

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

interface Rig {
	readonly outputRef: { current: StickyLayoutOutput | null };
}

function mountLayout(
	input: Omit<StickyLayoutInput, "currentHeight"> &
		Partial<Pick<StickyLayoutInput, "currentHeight">>,
): Rig {
	const outputRef: { current: StickyLayoutOutput | null } = { current: null };

	function Harness() {
		const out = useStickyLayout({
			...input,
			currentHeight: input.currentHeight ?? STICKY_NOTE_MIN_HEIGHT,
		});
		useEffect(() => {
			outputRef.current = out;
		});
		return null;
	}

	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);
	act(() => {
		root.render(<Harness />);
	});
	activeRoot = root;
	activeContainer = container;
	return { outputRef };
}

describe("useStickyLayout", () => {
	it("returns at least the minimum sticky note height for empty text", () => {
		const { outputRef } = mountLayout({
			text: "",
			isEditing: false,
			selected: false,
			widthMode: "auto",
			currentWidth: STICKY_NOTE_MIN_WIDTH,
			links: [],
			isValidRef: isAnyValid,
		});
		expect(outputRef.current?.nodeHeight).toBeGreaterThanOrEqual(
			STICKY_NOTE_MIN_HEIGHT,
		);
	});

	it("grows nodeHeight as text adds more lines", () => {
		const { outputRef: shortRef } = mountLayout({
			text: "one line",
			isEditing: false,
			selected: false,
			widthMode: "auto",
			currentWidth: STICKY_NOTE_MIN_WIDTH,
			links: [],
			isValidRef: isAnyValid,
		});
		const shortHeight = shortRef.current!.nodeHeight;

		act(() => {
			activeRoot?.unmount();
		});
		activeContainer?.remove();
		activeRoot = null;
		activeContainer = null;

		const { outputRef: tallRef } = mountLayout({
			text: "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight",
			isEditing: false,
			selected: false,
			widthMode: "auto",
			currentWidth: STICKY_NOTE_MIN_WIDTH,
			links: [],
			isValidRef: isAnyValid,
		});
		expect(tallRef.current!.nodeHeight).toBeGreaterThan(shortHeight);
	});

	it("preserves the input width in manual mode", () => {
		const manualWidth = 360;
		const { outputRef } = mountLayout({
			text: "hello",
			isEditing: false,
			selected: false,
			widthMode: "manual",
			currentWidth: manualWidth,
			links: [],
			isValidRef: isAnyValid,
		});
		expect(outputRef.current?.nodeWidth).toBe(manualWidth);
	});

	it("keeps manual-mode height at least as tall as the provided render height", () => {
		const manualWidth = 360;
		const manualHeight = 250;
		const { outputRef } = mountLayout({
			text: "hello",
			isEditing: false,
			selected: false,
			widthMode: "manual",
			currentWidth: manualWidth,
			currentHeight: manualHeight,
			links: [],
			isValidRef: isAnyValid,
		});
		expect(outputRef.current?.nodeHeight).toBeGreaterThanOrEqual(manualHeight);
	});

	it("grows manual-mode note height while editing when text needs more room", () => {
		const manualWidth = 220;
		const manualHeight = 160;
		const { outputRef } = mountLayout({
			text: "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten",
			isEditing: true,
			selected: false,
			widthMode: "manual",
			currentWidth: manualWidth,
			currentHeight: manualHeight,
			links: [],
			isValidRef: isAnyValid,
		});
		expect(outputRef.current!.nodeHeight).toBeGreaterThan(manualHeight);
	});

	it("returns a textareaBoxH suitable for sizing the editing textarea", () => {
		const { outputRef } = mountLayout({
			text: "",
			isEditing: true,
			selected: false,
			widthMode: "auto",
			currentWidth: STICKY_NOTE_MIN_WIDTH,
			links: [],
			isValidRef: isAnyValid,
		});
		expect(outputRef.current?.textareaBoxH).toBeGreaterThan(0);
	});
});
