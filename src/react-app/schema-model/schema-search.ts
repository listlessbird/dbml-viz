import type { SchemaIndexes } from "@/schema-model/schema-indexes";

export interface SchemaSearchResult {
	readonly matchedTableIds: readonly string[];
	readonly relatedTableIds: readonly string[];
	readonly highlightedEdgeIds: readonly string[];
}

export const EMPTY_SCHEMA_SEARCH_RESULT: SchemaSearchResult = Object.freeze({
	matchedTableIds: Object.freeze([]) as readonly string[],
	relatedTableIds: Object.freeze([]) as readonly string[],
	highlightedEdgeIds: Object.freeze([]) as readonly string[],
});

const tableMatchesQuery = (
	table: { name: string; id: string; schema?: string },
	loweredQuery: string,
) => {
	if (table.name.toLowerCase().includes(loweredQuery)) return true;
	if (table.id.toLowerCase().includes(loweredQuery)) return true;
	if (
		table.schema &&
		`${table.schema}.${table.name}`.toLowerCase().includes(loweredQuery)
	) {
		return true;
	}
	return false;
};

export const searchSchema = (
	indexes: SchemaIndexes,
	rawQuery: string,
): SchemaSearchResult => {
	const query = rawQuery.trim().toLowerCase();
	if (query.length === 0) return EMPTY_SCHEMA_SEARCH_RESULT;

	const matched = new Set<string>();
	for (const table of indexes.tablesById.values()) {
		if (tableMatchesQuery(table, query)) {
			matched.add(table.id);
		}
	}
	if (matched.size === 0) return EMPTY_SCHEMA_SEARCH_RESULT;

	const related = new Set<string>();
	const highlightedEdges = new Set<string>();
	for (const matchedId of matched) {
		const refs = indexes.refsByTableId.get(matchedId);
		if (!refs) continue;
		for (const ref of refs) {
			highlightedEdges.add(ref.id);
			if (!matched.has(ref.from.table)) related.add(ref.from.table);
			if (!matched.has(ref.to.table)) related.add(ref.to.table);
		}
	}

	return {
		matchedTableIds: Array.from(matched).sort(),
		relatedTableIds: Array.from(related).sort(),
		highlightedEdgeIds: Array.from(highlightedEdges).sort(),
	};
};
