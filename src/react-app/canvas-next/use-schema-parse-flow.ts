import { useEffect, useMemo } from "react";

import { useDiagramSession } from "@/diagram-session/diagram-session-context";
import type { ParseSchemaSourceFn } from "@/schema-source/parse-schema-source";
import { createSchemaSourceParserAdapter } from "@/schema-source-editor/schema-source-parser-adapter";

export interface UseSchemaParseFlowOptions {
	readonly parser?: ParseSchemaSourceFn;
	readonly debounceMs?: number;
}

export function useSchemaParseFlow({
	parser,
	debounceMs,
}: UseSchemaParseFlowOptions = {}) {
	const source = useDiagramSession((state) => state.diagram.source);
	const applyParseResult = useDiagramSession((state) => state.applyParseResult);
	const parserAdapter = useMemo(
		() =>
			createSchemaSourceParserAdapter({
				parser,
				debounceMs,
				onResult: applyParseResult,
			}),
		[applyParseResult, debounceMs, parser],
	);

	useEffect(() => {
		parserAdapter.schedule(source);
	}, [parserAdapter, source]);

	useEffect(() => () => parserAdapter.dispose(), [parserAdapter]);
}
