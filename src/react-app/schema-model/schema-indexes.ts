import {
	resolveRelationship,
	type RelationAnchor,
	type ResolvedRelationship,
} from "@/schema-model/relation-anchors";
import type { ColumnData, ParsedSchema, RefData, TableData } from "@/types";

export interface SchemaIndexes {
	readonly tablesById: ReadonlyMap<string, TableData>;
	readonly refsByTableId: ReadonlyMap<string, readonly RefData[]>;
	readonly columnsByTableAndName: ReadonlyMap<string, ColumnData>;
	readonly foreignKeyColumnsByTableId: ReadonlyMap<string, ReadonlySet<string>>;
	readonly relationships: readonly ResolvedRelationship[];
	readonly relationAnchorsByTableId: ReadonlyMap<string, readonly RelationAnchor[]>;
}

const columnKey = (tableId: string, columnName: string) => `${tableId}:${columnName}`;

const appendRef = (
	target: Map<string, RefData[]>,
	tableId: string,
	ref: RefData,
) => {
	const existing = target.get(tableId);
	if (existing) {
		existing.push(ref);
		return;
	}
	target.set(tableId, [ref]);
};

const appendForeignKey = (
	target: Map<string, Set<string>>,
	tableId: string,
	columns: readonly string[],
) => {
	const existing = target.get(tableId);
	if (existing) {
		for (const column of columns) {
			existing.add(column);
		}
		return;
	}
	target.set(tableId, new Set(columns));
};

export const buildSchemaIndexes = (parsed: ParsedSchema): SchemaIndexes => {
	const tablesById = new Map<string, TableData>();
	const columnsByTableAndName = new Map<string, ColumnData>();

	for (const table of parsed.tables) {
		tablesById.set(table.id, table);
		for (const column of table.columns) {
			columnsByTableAndName.set(columnKey(table.id, column.name), column);
		}
	}

	const refsByTableId = new Map<string, RefData[]>();
	const foreignKeyColumnsByTableId = new Map<string, Set<string>>();
	const relationships: ResolvedRelationship[] = [];
	const relationAnchorsByTableId = new Map<string, RelationAnchor[]>();

	for (const ref of parsed.refs) {
		appendRef(refsByTableId, ref.from.table, ref);
		if (ref.to.table !== ref.from.table) {
			appendRef(refsByTableId, ref.to.table, ref);
		}
		appendForeignKey(foreignKeyColumnsByTableId, ref.from.table, ref.from.columns);

		const resolved = resolveRelationship(ref);
		relationships.push(resolved);
		const fromAnchors = relationAnchorsByTableId.get(resolved.from.tableId);
		if (fromAnchors) {
			fromAnchors.push(resolved.from);
		} else {
			relationAnchorsByTableId.set(resolved.from.tableId, [resolved.from]);
		}
		const toAnchors = relationAnchorsByTableId.get(resolved.to.tableId);
		if (toAnchors) {
			toAnchors.push(resolved.to);
		} else {
			relationAnchorsByTableId.set(resolved.to.tableId, [resolved.to]);
		}
	}

	return {
		tablesById,
		refsByTableId,
		columnsByTableAndName,
		foreignKeyColumnsByTableId,
		relationships,
		relationAnchorsByTableId,
	};
};
