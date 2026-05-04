import { ReactFlowProvider, type NodeProps } from "@xyflow/react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { CanvasNextStickyNoteNode } from "@/canvas-next/sticky-note";
import { DiagramSessionContext } from "@/diagram-session/diagram-session-context";
import {
	createDiagramSessionStore,
	type DiagramSessionStore,
} from "@/diagram-session/diagram-session-store";
import type { ParsedSchema, SharedStickyNote, StickyNoteNode } from "@/types";

const schemaWithUsers: ParsedSchema = {
	tables: [
		{
			id: "users",
			name: "users",
			columns: [
				{
					name: "id",
					type: "int",
					pk: true,
					notNull: true,
					unique: false,
					isForeignKey: false,
					isIndexed: false,
				},
			],
			indexes: [],
		},
	],
	refs: [],
	errors: [],
};

const yellowNote: SharedStickyNote = {
	id: "sticky-1",
	x: 0,
	y: 0,
	width: 220,
	height: 160,
	color: "yellow",
	text: "",
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

interface RenderOptions {
	readonly note?: SharedStickyNote;
	readonly notes?: readonly SharedStickyNote[];
	readonly parsedSchema?: ParsedSchema;
	readonly selected?: boolean;
}

function renderNode({
	note = yellowNote,
	notes,
	parsedSchema = schemaWithUsers,
	selected = false,
}: RenderOptions = {}): {
	readonly container: HTMLDivElement;
	readonly diagramStore: DiagramSessionStore;
} {
	const diagramStore = createDiagramSessionStore({
		source: "",
		parsedSchema,
		tablePositions: { users: { x: 0, y: 0 } },
		stickyNotes: notes ?? [note],
	});
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);

	const props: NodeProps<StickyNoteNode> = {
		id: note.id,
		type: "sticky",
		data: { note },
		selected,
		dragging: false,
		isConnectable: false,
		positionAbsoluteX: note.x,
		positionAbsoluteY: note.y,
		zIndex: 0,
		selectable: true,
		deletable: true,
		draggable: true,
		width: note.width,
		height: note.height,
	};

	act(() => {
		root.render(
			<DiagramSessionContext value={diagramStore}>
				<ReactFlowProvider>
					<CanvasNextStickyNoteNode {...props} />
				</ReactFlowProvider>
			</DiagramSessionContext>,
		);
	});

	activeRoot = root;
	activeContainer = container;

	return { container, diagramStore };
}

describe("CanvasNextStickyNoteNode DOM", () => {
	it("renders a draggable header strip without the React Flow nodrag class", () => {
		const { container } = renderNode();
		const header = container.querySelector<HTMLElement>(
			"[data-testid='sticky-note-drag-handle']",
		);
		expect(header).not.toBeNull();
		expect(header?.classList.contains("nodrag")).toBe(false);
	});

	it("marks the editing textarea with nodrag so React Flow won't drag from it", () => {
		const { container } = renderNode({
			note: { ...yellowNote, text: "" },
		});
		const textarea = container.querySelector<HTMLTextAreaElement>("textarea");
		expect(textarea).not.toBeNull();
		expect(textarea?.classList.contains("nodrag")).toBe(true);
	});

	it("renders the durable note text in the body when not editing", () => {
		const { container } = renderNode({
			note: { ...yellowNote, text: "Hello world" },
			selected: false,
		});
		expect(container.textContent).toContain("Hello world");
	});

	it("propagates color via a data-color attribute on the root", () => {
		const { container } = renderNode({
			note: { ...yellowNote, color: "blue" },
		});
		const root = container.querySelector<HTMLElement>(
			"[data-testid='sticky-note-root']",
		);
		expect(root?.getAttribute("data-color")).toBe("blue");
	});

	it("commits textarea edits through Diagram Session.updateStickyNote", () => {
		const { container, diagramStore } = renderNode();
		const textarea = container.querySelector<HTMLTextAreaElement>("textarea");
		expect(textarea).not.toBeNull();

		const setter = Object.getOwnPropertyDescriptor(
			HTMLTextAreaElement.prototype,
			"value",
		)!.set!;

		act(() => {
			setter.call(textarea!, "Hello");
			textarea!.setSelectionRange(5, 5);
			textarea!.dispatchEvent(new Event("input", { bubbles: true }));
		});

		const stored = diagramStore.getState().diagram.stickyNotes[0];
		expect(stored?.text).toBe("Hello");
	});

	it("renders prose tokens for valid #table refs when not editing", () => {
		const { container } = renderNode({
			note: { ...yellowNote, text: "see #users" },
		});
		const tokens = container.querySelectorAll<HTMLButtonElement>(
			"[data-testid='sticky-note-token']",
		);
		expect(tokens).toHaveLength(1);
		expect(tokens[0]?.textContent).toBe("#users");
	});

	it("renders link chips below the body when valid links exist", () => {
		const { container } = renderNode({
			note: { ...yellowNote, text: "see #users" },
		});
		const chips = container.querySelectorAll<HTMLButtonElement>(
			"[data-testid='sticky-note-chip']",
		);
		expect(chips).toHaveLength(1);
		expect(chips[0]?.textContent).toContain("users");
	});

	it("shows the color palette only when selected and not editing", () => {
		const { container } = renderNode({
			note: { ...yellowNote, text: "see #users" },
			selected: true,
		});
		const blueSwatch = container.querySelector(
			"[data-testid='sticky-note-swatch-blue']",
		);
		expect(blueSwatch).not.toBeNull();
	});

	it("commits palette picks through Diagram Session.updateStickyNote", () => {
		const { container, diagramStore } = renderNode({
			note: { ...yellowNote, text: "see #users" },
			selected: true,
		});
		const greenSwatch = container.querySelector<HTMLButtonElement>(
			"[data-testid='sticky-note-swatch-green']",
		);
		expect(greenSwatch).not.toBeNull();

		act(() => {
			greenSwatch!.click();
		});

		expect(diagramStore.getState().diagram.stickyNotes[0]?.color).toBe(
			"green",
		);
	});

	it("deletes the sticky note when the editbar trash is pressed", () => {
		const { container, diagramStore } = renderNode();
		const trash = container.querySelector<HTMLButtonElement>(
			"[data-testid='sticky-note-delete']",
		);
		expect(trash).not.toBeNull();

		act(() => {
			trash!.dispatchEvent(
				new PointerEvent("pointerdown", { bubbles: true, cancelable: true }),
			);
		});

		expect(diagramStore.getState().diagram.stickyNotes).toEqual([]);
	});
});
