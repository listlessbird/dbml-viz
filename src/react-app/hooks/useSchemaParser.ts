import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { getPreferredSourceMetadata } from "@/lib/schema-source-detection";
import { parseSchema, SchemaParseError } from "@/lib/parser";
import { EMPTY_SCHEMA } from "@/lib/parser-shared";
import type { ParseDiagnostic } from "@/types";

const useDebouncedValue = <T>(value: T, delay: number): T => {
	const [debounced, setDebounced] = useState(value);

	useEffect(() => {
		const id = window.setTimeout(() => setDebounced(value), delay);
		return () => window.clearTimeout(id);
	}, [value, delay]);

	return debounced;
};

const errorToDiagnostics = (error: unknown): readonly ParseDiagnostic[] => {
	if (error instanceof SchemaParseError) {
		return [...error.diagnostics];
	}
	return [
		{
			message: error instanceof Error ? error.message : "Unable to parse schema source.",
		},
	];
};

export const useSchemaParser = (source: string, delay = 300) => {
	const debouncedSource = useDebouncedValue(source, delay);
	const heuristicMetadata = getPreferredSourceMetadata(source);

	const query = useQuery({
		queryKey: ["parse-schema", debouncedSource] as const,
		queryFn: () => parseSchema(debouncedSource),
		placeholderData: keepPreviousData,
	});

	const parsed = query.data?.parsed ?? EMPTY_SCHEMA;
	const diagnostics = query.error ? errorToDiagnostics(query.error) : [];
	const isParsing = query.isFetching || debouncedSource !== source;
	const metadata =
		query.data && !query.isPlaceholderData && debouncedSource === source
			? query.data.metadata
			: heuristicMetadata;

	return { parsed, diagnostics, isParsing, metadata };
};
