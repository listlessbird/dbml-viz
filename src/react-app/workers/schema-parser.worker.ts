/// <reference lib="webworker" />

import {
	extractDiagnostics,
	type SchemaParserRequest,
	type SchemaParserResponse,
} from "@/lib/parser-shared";
import { parseSchemaSource } from "@/lib/schema-source-parser";

const workerScope = self as DedicatedWorkerGlobalScope;

workerScope.addEventListener("message", (event: MessageEvent<SchemaParserRequest>) => {
	const { id, source } = event.data;

	void Promise.resolve(parseSchemaSource(source))
		.then(({ parsed }) => {
			const response: SchemaParserResponse = {
				id,
				ok: true,
				parsed,
			};
			workerScope.postMessage(response);
		})
		.catch((error) => {
			const response: SchemaParserResponse = {
				id,
				ok: false,
				diagnostics: extractDiagnostics(error),
			};
			workerScope.postMessage(response);
		});
});
