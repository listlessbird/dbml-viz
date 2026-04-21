import {
	useCallback,
	useState,
	type ChangeEvent,
	type RefObject,
} from "react";

import { useStickyNotesStore } from "@/store/useStickyNotesStore";
import type { ColumnData, TableData } from "@/types";

import type { LinkerStage } from "./LinkerPopover";

export interface StickyLinkerController {
	readonly open: boolean;
	readonly stage: LinkerStage;
	readonly scopedTable: TableData | null;
	readonly setOpen: (open: boolean) => void;
	readonly resetToTables: () => void;
	readonly handleChangeText: (
		event: ChangeEvent<HTMLTextAreaElement>,
	) => void;
	readonly handlePickTable: (table: TableData) => void;
	readonly handlePickColumn: (table: TableData, column: ColumnData) => void;
}

export function useStickyLinker(
	id: string,
	textareaRef: RefObject<HTMLTextAreaElement | null>,
	selected: boolean,
): StickyLinkerController {
	const [openInternal, setOpen] = useState(false);
	const [stage, setStage] = useState<LinkerStage>("tables");
	const [scopedTable, setScopedTable] = useState<TableData | null>(null);

	// Derive open from selection so deselecting hides the popover without
	// a state-mirroring effect. Opening while unselected can't happen —
	// every path that calls setOpen(true) runs from the focused textarea.
	const open = openInternal && selected;

	const resetToTables = useCallback(() => {
		setStage("tables");
		setScopedTable(null);
	}, []);

	const handleChangeText = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			const next = event.target.value;
			useStickyNotesStore.getState().updateText(id, next);

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
		[id, scopedTable],
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
			useStickyNotesStore.getState().updateText(id, next);
			requestAnimationFrame(() => {
				if (!textareaRef.current) return;
				const caret = before.length + token.length;
				textareaRef.current.focus();
				textareaRef.current.setSelectionRange(caret, caret);
			});
		},
		[id, textareaRef],
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
