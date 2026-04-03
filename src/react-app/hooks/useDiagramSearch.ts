import { useDeferredValue, useMemo } from "react";

import { searchDiagram } from "@/lib/search";
import type { ParsedSchema } from "@/types";

interface DiagramSearchResult {
	readonly searchState: ReturnType<typeof searchDiagram>;
	readonly matchedTableNames: string[];
	readonly searchFocusIds: string[];
}

export function useDiagramSearch(
	parsed: ParsedSchema,
	searchQuery: string,
): DiagramSearchResult {
	const deferredSearchQuery = useDeferredValue(searchQuery);
	const searchState = useMemo(
		() => searchDiagram(parsed, deferredSearchQuery),
		[deferredSearchQuery, parsed],
	);

	const matchedTableNames = useMemo(() => {
		if (searchState.matchedTableIds.length === 0) {
			return [];
		}

		const matchedTableIds = new Set(searchState.matchedTableIds);
		return parsed.tables
			.filter((table) => matchedTableIds.has(table.id))
			.map((table) => (table.schema ? `${table.schema}.${table.name}` : table.name));
	}, [parsed.tables, searchState.matchedTableIds]);

	const searchFocusIds = useMemo(
		() => [...searchState.matchedTableIds, ...searchState.relatedTableIds],
		[searchState.matchedTableIds, searchState.relatedTableIds],
	);

	return {
		searchState,
		matchedTableNames,
		searchFocusIds,
	};
}
