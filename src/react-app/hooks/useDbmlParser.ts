import { useEffect, useState } from "react";

import { DbmlParseError, parseDbml } from "@/lib/parser";
import type { ParseDiagnostic, ParsedSchema } from "@/types";

const EMPTY_SCHEMA: ParsedSchema = {
	tables: [],
	refs: [],
	errors: [],
};

export const useDbmlParser = (dbml: string, delay = 300) => {
	const [parsed, setParsed] = useState<ParsedSchema>(EMPTY_SCHEMA);
	const [diagnostics, setDiagnostics] = useState<ParseDiagnostic[]>([]);
	const [isParsing, setIsParsing] = useState(false);

	useEffect(() => {
		let cancelled = false;

		const timeoutId = window.setTimeout(() => {
			setIsParsing(true);
			void parseDbml(dbml)
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
						error instanceof DbmlParseError
							? [...error.diagnostics]
							: [
									{
										message:
											error instanceof Error
												? error.message
												: "Unable to parse DBML.",
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
	}, [dbml, delay]);

	return {
		parsed,
		diagnostics,
		isParsing,
	};
};
