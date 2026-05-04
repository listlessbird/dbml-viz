import { act, useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { useStickyLinker } from "@/canvas-next/sticky-note/use-sticky-linker";
import { DiagramSessionContext } from "@/diagram-session/diagram-session-context";
import {
	createDiagramSessionStore,
	type DiagramSessionStore,
} from "@/diagram-session/diagram-session-store";
import type { ParsedSchema, SharedStickyNote, TableData } from "@/types";

const usersTable: TableData = {
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
};

const baseNote: SharedStickyNote = {
	id: "sticky-1",
	x: 0,
	y: 0,
	width: 220,
	height: 160,
	color: "yellow",
	text: "",
};

const schema: ParsedSchema = {
	tables: [usersTable],
	refs: [],
	errors: [],
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

interface LinkerRig {
	readonly diagramStore: DiagramSessionStore;
	readonly textarea: HTMLTextAreaElement;
	readonly controllerRef: { current: ReturnType<typeof useStickyLinker> | null };
}

function mountLinker(): LinkerRig {
	const diagramStore = createDiagramSessionStore({
		source: "",
		parsedSchema: schema,
		tablePositions: { users: { x: 0, y: 0 } },
		stickyNotes: [baseNote],
	});
	const container = document.createElement("div");
	document.body.appendChild(container);
	const textareaHolder: { current: HTMLTextAreaElement | null } = {
		current: null,
	};
	const controllerRef: { current: ReturnType<typeof useStickyLinker> | null } =
		{
			current: null,
		};

	function Harness() {
		const ref = useRef<HTMLTextAreaElement | null>(null);
		const linker = useStickyLinker({
			id: "sticky-1",
			textareaRef: ref,
			selected: true,
		});
		useEffect(() => {
			controllerRef.current = linker;
		});
		return (
			<textarea
				ref={(node) => {
					ref.current = node;
					textareaHolder.current = node;
				}}
				defaultValue={baseNote.text}
				onChange={linker.handleChangeText}
			/>
		);
	}

	const root = createRoot(container);
	act(() => {
		root.render(
			<DiagramSessionContext value={diagramStore}>
				<Harness />
			</DiagramSessionContext>,
		);
	});

	if (!textareaHolder.current) {
		throw new Error("textarea did not mount");
	}

	activeRoot = root;
	activeContainer = container;

	return {
		diagramStore,
		textarea: textareaHolder.current,
		controllerRef,
	};
}

const nativeValueSetter = Object.getOwnPropertyDescriptor(
	HTMLTextAreaElement.prototype,
	"value",
)!.set!;

function typeAt(textarea: HTMLTextAreaElement, value: string, caret: number) {
	nativeValueSetter.call(textarea, value);
	textarea.setSelectionRange(caret, caret);
	textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("useStickyLinker", () => {
	it("opens the table stage when '#' is typed", () => {
		const { textarea, controllerRef } = mountLinker();
		expect(controllerRef.current?.open).toBe(false);

		act(() => {
			typeAt(textarea, "#", 1);
		});

		expect(controllerRef.current?.open).toBe(true);
		expect(controllerRef.current?.stage).toBe("tables");
	});

	it("inserts '#TableName' at caret on table pick and closes the popover", () => {
		const { diagramStore, textarea, controllerRef } = mountLinker();

		act(() => {
			typeAt(textarea, "#", 1);
		});

		act(() => {
			controllerRef.current?.handlePickTable(usersTable);
		});

		const text = diagramStore.getState().diagram.stickyNotes[0]?.text;
		expect(text).toBe("#users");
		expect(controllerRef.current?.open).toBe(false);
		expect(controllerRef.current?.scopedTable?.name).toBe("users");
	});

	it("opens the column stage when '.' follows a scoped table", () => {
		const { textarea, controllerRef } = mountLinker();

		act(() => {
			typeAt(textarea, "#", 1);
		});
		act(() => {
			controllerRef.current?.handlePickTable(usersTable);
		});

		act(() => {
			typeAt(textarea, "#users.", 7);
		});

		expect(controllerRef.current?.open).toBe(true);
		expect(controllerRef.current?.stage).toBe("columns");
	});

	it("inserts '.column' on column pick and closes the popover", () => {
		const { diagramStore, textarea, controllerRef } = mountLinker();

		act(() => {
			typeAt(textarea, "#", 1);
		});
		act(() => {
			controllerRef.current?.handlePickTable(usersTable);
		});
		act(() => {
			typeAt(textarea, "#users.", 7);
		});
		act(() => {
			controllerRef.current?.handlePickColumn(usersTable, usersTable.columns[0]!);
		});

		const text = diagramStore.getState().diagram.stickyNotes[0]?.text;
		expect(text).toBe("#users.id");
		expect(controllerRef.current?.open).toBe(false);
	});

});
