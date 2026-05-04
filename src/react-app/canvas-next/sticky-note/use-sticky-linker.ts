import {
	useCallback,
	useState,
	type ChangeEvent,
	type RefObject,
} from "react";

import { useDiagramSession } from "@/diagram-session/diagram-session-context";
import type { ColumnData, TableData } from "@/types";

export type LinkerStage = "tables" | "columns";

export interface StickyLinkerController {
	readonly open: boolean;
	readonly stage: LinkerStage;
	readonly scopedTable: TableData | null;
	readonly setOpen: (open: boolean) => void;
	readonly resetToTables: () => void;
	readonly handleChangeText: (event: ChangeEvent<HTMLTextAreaElement>) => void;
	readonly handlePickTable: (table: TableData) => void;
	readonly handlePickColumn: (table: TableData, column: ColumnData) => void;
}

export interface StickyLinkerInput {
	readonly id: string;
	readonly textareaRef: RefObject<HTMLTextAreaElement | null>;
	readonly selected: boolean;
}

export function useStickyLinker({
	id,
	textareaRef,
	selected,
}: StickyLinkerInput): StickyLinkerController {
	const updateStickyNote = useDiagramSession((state) => state.updateStickyNote);
	const [openInternal, setOpen] = useState(false);
	const [stage, setStage] = useState<LinkerStage>("tables");
	const [scopedTable, setScopedTable] = useState<TableData | null>(null);

	const open = openInternal && selected;

	const resetToTables = useCallback(() => {
		setStage("tables");
		setScopedTable(null);
	}, []);

	const handleChangeText = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			const next = event.target.value;
			updateStickyNote(id, { text: next });

			const caret = event.target.selectionStart ?? next.length;
			const prevChar = next.slice(caret - 1, caret);
			if (prevChar === "#") {
				setStage("tables");
				setScopedTable(null);
				setOpen(true);
			} else if (prevChar === "." && scopedTable) {
				setStage("columns");
				setOpen(true);
			}
		},
		[id, scopedTable, updateStickyNote],
	);

	const insertAtCaret = useCallback(
		(token: string, eraseBack: number) => {
			const el = textareaRef.current;
			if (!el) return;
			const start = el.selectionStart ?? el.value.length;
			const end = el.selectionEnd ?? start;
			const before = el.value.slice(0, Math.max(0, start - eraseBack));
			const after = el.value.slice(end);
			const next = `${before}${token}${after}`;
			updateStickyNote(id, { text: next });
			el.value = next;
			requestAnimationFrame(() => {
				if (!textareaRef.current) return;
				const caret = before.length + token.length;
				textareaRef.current.focus();
				textareaRef.current.setSelectionRange(caret, caret);
			});
		},
		[id, textareaRef, updateStickyNote],
	);

	const handlePickTable = useCallback(
		(table: TableData) => {
			insertAtCaret(`#${table.name}`, 1);
			setScopedTable(table);
			setStage("columns");
			setOpen(false);
		},
		[insertAtCaret],
	);

	const handlePickColumn = useCallback(
		(_table: TableData, column: ColumnData) => {
			insertAtCaret(`.${column.name}`, 1);
			setOpen(false);
			setScopedTable(null);
			setStage("tables");
		},
		[insertAtCaret],
	);

	return {
		open,
		stage,
		scopedTable,
		setOpen,
		resetToTables,
		handleChangeText,
		handlePickTable,
		handlePickColumn,
	};
}
