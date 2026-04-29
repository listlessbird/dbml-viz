import { useEffect } from "react";

import { useDiagramSession } from "@/diagram-session/diagram-session-context";
import {
	parseSchemaSource,
	type ParseSchemaSourceFn,
} from "@/schema-source/parse-schema-source";

export interface UseSchemaParseFlowOptions {
	readonly parser?: ParseSchemaSourceFn;
}

export function useSchemaParseFlow({ parser }: UseSchemaParseFlowOptions = {}) {
	const source = useDiagramSession((state) => state.diagram.source);
	const applyParseResult = useDiagramSession((state) => state.applyParseResult);

	useEffect(() => {
		let cancelled = false;
		void parseSchemaSource(source, { parser }).then((result) => {
			if (cancelled) return;
			applyParseResult(result);
		});
		return () => {
			cancelled = true;
		};
	}, [source, parser, applyParseResult]);
}
