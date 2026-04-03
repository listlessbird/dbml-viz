import type { ParsedSchema } from "@/types";

export interface DiagramSearchState {
	readonly matchedTableIds: string[];
	readonly relatedTableIds: string[];
	readonly highlightedEdgeIds: string[];
}

export interface DiagramSearchContext {
	readonly matchedTableIds: ReadonlySet<string>;
	readonly relatedTableIds: ReadonlySet<string>;
	readonly highlightedEdgeIds: ReadonlySet<string>;
}

const EMPTY_SEARCH_STATE: DiagramSearchState = {
	matchedTableIds: [],
	relatedTableIds: [],
	highlightedEdgeIds: [],
};

export const searchDiagram = (
	parsed: ParsedSchema,
	rawQuery: string,
): DiagramSearchState => {
	const query = rawQuery.trim().toLowerCase();
	if (query.length === 0) {
		return EMPTY_SEARCH_STATE;
	}

	const matchedTableIds = new Set<string>();

	for (const table of parsed.tables) {
		const identifiers = [
			table.name,
			table.id,
			table.schema ? `${table.schema}.${table.name}` : null,
		];

		if (
			identifiers.some(
				(identifier) => identifier !== null && identifier.toLowerCase().includes(query),
			)
		) {
			matchedTableIds.add(table.id);
		}
	}

	if (matchedTableIds.size === 0) {
		return EMPTY_SEARCH_STATE;
	}

	const relatedTableIds = new Set<string>();
	const highlightedEdgeIds = new Set<string>();

	for (const ref of parsed.refs) {
		if (matchedTableIds.has(ref.from.table) || matchedTableIds.has(ref.to.table)) {
			relatedTableIds.add(ref.from.table);
			relatedTableIds.add(ref.to.table);
			highlightedEdgeIds.add(ref.id);
		}
	}

	for (const tableId of matchedTableIds) {
		relatedTableIds.delete(tableId);
	}

	return {
		matchedTableIds: Array.from(matchedTableIds).sort(),
		relatedTableIds: Array.from(relatedTableIds).sort(),
		highlightedEdgeIds: Array.from(highlightedEdgeIds).sort(),
	};
};

export const createDiagramSearchContext = (
	searchState: DiagramSearchState,
): DiagramSearchContext => ({
	matchedTableIds: new Set(searchState.matchedTableIds),
	relatedTableIds: new Set(searchState.relatedTableIds),
	highlightedEdgeIds: new Set(searchState.highlightedEdgeIds),
});
