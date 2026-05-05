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
import { DiagramSessionContext } from "@/diagram-session/diagram-session-context";
import {
	createDiagramSessionStore,
	type DiagramSessionStore,
} from "@/diagram-session/diagram-session-store";
import type { ParsedSchema, SharedStickyNote } from "@/types";

const isAnyValid = () => true;

const baseSchema: ParsedSchema = {
	tables: [],
	refs: [],
	errors: [],
};

const makeNote = (
	overrides: Partial<SharedStickyNote> = {},
): SharedStickyNote => ({
	id: "sticky-1",
	x: 0,
	y: 0,
	width: STICKY_NOTE_MIN_WIDTH,
	height: STICKY_NOTE_MIN_HEIGHT,
	color: "yellow",
	text: "",
	...overrides,
});

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
	readonly diagramStore: DiagramSessionStore;
	readonly outputRef: { current: StickyLayoutOutput | null };
}

function mountLayout(
	input: Omit<StickyLayoutInput, "id" | "currentHeight"> &
		Partial<Pick<StickyLayoutInput, "currentHeight">>,
	note: SharedStickyNote = makeNote(
		input.currentHeight === undefined
			? { width: input.currentWidth }
			: { width: input.currentWidth, height: input.currentHeight },
	),
): Rig {
	const diagramStore = createDiagramSessionStore({
		source: "",
		parsedSchema: baseSchema,
		tablePositions: {},
		stickyNotes: [note],
	});
	const outputRef: { current: StickyLayoutOutput | null } = { current: null };

	function Harness() {
		const out = useStickyLayout({
			...input,
			id: note.id,
			currentHeight: input.currentHeight ?? note.height,
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
		root.render(
			<DiagramSessionContext value={diagramStore}>
				<Harness />
			</DiagramSessionContext>,
		);
	});
	activeRoot = root;
	activeContainer = container;
	return { diagramStore, outputRef };
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

		const { outputRef: tallRef } = mountLayout(
			{
				text: "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight",
				isEditing: false,
				selected: false,
				widthMode: "auto",
				currentWidth: STICKY_NOTE_MIN_WIDTH,
				links: [],
				isValidRef: isAnyValid,
			},
			makeNote({ id: "sticky-multi", width: STICKY_NOTE_MIN_WIDTH }),
		);
		expect(tallRef.current!.nodeHeight).toBeGreaterThan(shortHeight);
	});

	it("preserves the input width in manual mode", () => {
		const manualWidth = 360;
		const { outputRef } = mountLayout(
			{
				text: "hello",
				isEditing: false,
				selected: false,
				widthMode: "manual",
				currentWidth: manualWidth,
				links: [],
				isValidRef: isAnyValid,
			},
			makeNote({ width: manualWidth }),
		);
		expect(outputRef.current?.nodeWidth).toBe(manualWidth);
	});

	it("commits computed dims to Diagram Session in auto mode", () => {
		const { diagramStore } = mountLayout(
			{
				text: "hello",
				isEditing: false,
				selected: false,
				widthMode: "auto",
				currentWidth: STICKY_NOTE_MIN_WIDTH,
				links: [],
				isValidRef: isAnyValid,
			},
			makeNote({ width: STICKY_NOTE_MIN_WIDTH }),
		);
		const note = diagramStore.getState().diagram.stickyNotes[0]!;
		expect(note.width).toBeGreaterThanOrEqual(STICKY_NOTE_MIN_WIDTH);
		expect(note.height).toBeGreaterThanOrEqual(STICKY_NOTE_MIN_HEIGHT);
	});

	it("does not commit dims in manual mode when not editing", () => {
		const manualWidth = 360;
		const manualHeight = 250;
		const { diagramStore } = mountLayout(
			{
				text: "hello",
				isEditing: false,
				selected: false,
				widthMode: "manual",
				currentWidth: manualWidth,
				links: [],
				isValidRef: isAnyValid,
			},
			makeNote({ width: manualWidth, height: manualHeight }),
		);
		const note = diagramStore.getState().diagram.stickyNotes[0]!;
		expect(note.width).toBe(manualWidth);
		expect(note.height).toBe(manualHeight);
	});

	it("grows manual-mode note height while editing when text needs more room", () => {
		const manualWidth = 220;
		const manualHeight = 160;
		const { diagramStore, outputRef } = mountLayout(
			{
				text: "one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten",
				isEditing: true,
				selected: false,
				widthMode: "manual",
				currentWidth: manualWidth,
				currentHeight: manualHeight,
				links: [],
				isValidRef: isAnyValid,
			},
			makeNote({ width: manualWidth, height: manualHeight, widthMode: "manual" }),
		);
		const note = diagramStore.getState().diagram.stickyNotes[0]!;
		expect(outputRef.current!.nodeHeight).toBeGreaterThan(manualHeight);
		expect(note.width).toBe(manualWidth);
		expect(note.height).toBe(outputRef.current!.nodeHeight);
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
