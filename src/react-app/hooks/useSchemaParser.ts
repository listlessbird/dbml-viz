import { useEffect, useState } from "react";

import { parseSchema, SchemaParseError } from "@/lib/parser";
import type { ParseDiagnostic, ParsedSchema } from "@/types";

const EMPTY_SCHEMA: ParsedSchema = {
	tables: [],
	refs: [],
	errors: [],
};

export const useSchemaParser = (source: string, delay = 300) => {
	const [parsed, setParsed] = useState<ParsedSchema>(EMPTY_SCHEMA);
	const [diagnostics, setDiagnostics] = useState<ParseDiagnostic[]>([]);
	const [isParsing, setIsParsing] = useState(false);

	useEffect(() => {
		let cancelled = false;

		const timeoutId = window.setTimeout(() => {
			setIsParsing(true);
			void parseSchema(source)
				.then((nextParsed) => {
					if (cancelled) {
						return;
					}

					setParsed(nextParsed);
					setDiagnostics([]);
				})
				.catch((error) => {
					if (cancelled) {
						return;
					}

					setDiagnostics(
						error instanceof SchemaParseError
							? [...error.diagnostics]
							: [
									{
										message:
											error instanceof Error
												? error.message
												: "Unable to parse schema source.",
									},
								],
					);
				})
				.finally(() => {
					if (!cancelled) {
						setIsParsing(false);
					}
				});
		}, delay);

		return () => {
			cancelled = true;
			window.clearTimeout(timeoutId);
		};
	}, [source, delay]);

	return {
		parsed,
		diagnostics,
		isParsing,
	};
};
