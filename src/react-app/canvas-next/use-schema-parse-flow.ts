import { useEffect } from "react";

import { isSchemaSourceEmpty } from "@/canvas-next/canvas-empty-state/derive-canvas-state";
import { useDiagramSession } from "@/diagram-session/diagram-session-context";
import {
	emptyParseResult,
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
		if (isSchemaSourceEmpty(source)) {
			applyParseResult(emptyParseResult);
			return;
		}

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
