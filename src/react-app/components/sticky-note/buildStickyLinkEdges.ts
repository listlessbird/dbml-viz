import { getTargetHandleId } from "@/lib/relation-handles";
import type { StickyNoteRecord } from "@/store/useStickyNotesStore";
import type { DiagramNode, StickyLinkEdge } from "@/types";

import { parseLinksFromText } from "./linkHelpers";

interface TableLookupEntry {
	readonly id: string;
	readonly columns: ReadonlySet<string>;
}

export type TableLookupByName = ReadonlyMap<string, TableLookupEntry>;

export const buildTableLookupByName = (nodes: readonly DiagramNode[]): TableLookupByName => {
	const byName = new Map<string, TableLookupEntry>();
	for (const node of nodes) {
		const table = node.data.table;
		byName.set(table.name, {
			id: node.id,
			columns: new Set(table.columns.map((col) => col.name)),
		});
	}
	return byName;
};

// Derive view-only dashed edges from sticky note text. These never enter
// the parent edge store — they exist for visual wiring only.
export const buildStickyLinkEdges = (
	notes: readonly StickyNoteRecord[],
	texts: Readonly<Record<string, string>>,
	tables: TableLookupByName,
): StickyLinkEdge[] => {
	if (notes.length === 0 || tables.size === 0) return [];

	const isValid = (tableName: string, columnName?: string) => {
		const entry = tables.get(tableName);
		if (!entry) return false;
		if (columnName && !entry.columns.has(columnName)) return false;
		return true;
	};

	const edges: StickyLinkEdge[] = [];
	for (const note of notes) {
		const text = texts[note.id];
		if (!text) continue;
		for (const link of parseLinksFromText(text, isValid)) {
			const entry = tables.get(link.table);
			if (!entry) continue;
			const id = link.column
				? `sticky-link-${note.id}-${entry.id}-${link.column}`
				: `sticky-link-${note.id}-${entry.id}`;
			edges.push({
				id,
				source: note.id,
				target: entry.id,
				targetHandle: link.column ? getTargetHandleId(entry.id, link.column) : undefined,
				type: "stickyLink",
				selectable: false,
				focusable: false,
				data: {
					color: note.color,
					tableName: link.table,
					columnName: link.column,
				},
			});
		}
	}
	return edges;
};

export const isStickyLinkEdgeId = (id: string) => id.startsWith("sticky-link-");
