import { useCallback, useDeferredValue, useEffect, useMemo } from "react";

import { useCanvasRuntime } from "@/canvas-next/canvas-runtime-context";
import { useDiagramSession } from "@/diagram-session/diagram-session-context";
import { buildSchemaIndexes } from "@/schema-model/schema-indexes";
import {
	EMPTY_SCHEMA_SEARCH_RESULT,
	searchSchema,
	type SchemaSearchResult,
} from "@/schema-model/schema-search";

interface CanvasSearchEmphasis {
	readonly result: SchemaSearchResult;
	readonly matchedTables: readonly {
		readonly id: string;
		readonly name: string;
		readonly label: string;
		readonly schema?: string;
	}[];
	readonly matchedTableNames: readonly string[];
	readonly focusMatched: () => void;
}

export function useCanvasSearchEmphasis(query: string): CanvasSearchEmphasis {
	const parsedSchema = useDiagramSession((state) => state.diagram.parsedSchema);
	const setSearchHighlight = useCanvasRuntime((state) => state.setSearchHighlight);
	const clearSearchHighlight = useCanvasRuntime(
		(state) => state.clearSearchHighlight,
	);
	const requestFocus = useCanvasRuntime((state) => state.requestFocus);

	const indexes = useMemo(() => buildSchemaIndexes(parsedSchema), [parsedSchema]);
	const deferredQuery = useDeferredValue(query);

	const result = useMemo(
		() => searchSchema(indexes, deferredQuery),
		[indexes, deferredQuery],
	);

	useEffect(() => {
		if (result === EMPTY_SCHEMA_SEARCH_RESULT) {
			clearSearchHighlight();
			return;
		}
		setSearchHighlight(result);
	}, [clearSearchHighlight, result, setSearchHighlight]);

	useEffect(() => {
		return () => {
			clearSearchHighlight();
		};
	}, [clearSearchHighlight]);

	const matchedTables = useMemo(() => {
		if (result.matchedTableIds.length === 0) return [];
		const matchedIds = new Set(result.matchedTableIds);
		return parsedSchema.tables
			.filter((table) => matchedIds.has(table.id))
			.map((table) => ({
				id: table.id,
				name: table.name,
				label: table.schema ? `${table.schema}.${table.name}` : table.name,
				schema: table.schema,
			}));
	}, [parsedSchema.tables, result.matchedTableIds]);
	const matchedTableNames = useMemo(
		() => matchedTables.map((table) => table.label),
		[matchedTables],
	);

	const focusMatched = useCallback(() => {
		if (result.matchedTableIds.length === 0) return;
		requestFocus(result.matchedTableIds);
	}, [requestFocus, result.matchedTableIds]);

	return { result, matchedTables, matchedTableNames, focusMatched };
}
