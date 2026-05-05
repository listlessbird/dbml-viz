import { useEffect } from "react";

import { useDiagramSession } from "@/diagram-session/diagram-session-context";
import {
	parseSchemaSource,
	type ParseSchemaSourceFn,
} from "@/schema-source/parse-schema-source";

interface UseSchemaParseFlowOptions {
	readonly parser?: ParseSchemaSourceFn;
	readonly debounceMs?: number;
}

const DEFAULT_DEBOUNCE_MS = 300;

export function useSchemaParseFlow({
	parser,
	debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseSchemaParseFlowOptions = {}) {
	const source = useDiagramSession((state) => state.diagram.source);
	const applyParseResult = useDiagramSession((state) => state.applyParseResult);

	useEffect(() => {
		if (source.trim().length === 0) return;

		let cancelled = false;
		const timer = setTimeout(() => {
			void parseSchemaSource(source, { parser }).then((result) => {
				if (cancelled) return;
				applyParseResult(result);
			});
		}, debounceMs);

		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [source, parser, debounceMs, applyParseResult]);
}
