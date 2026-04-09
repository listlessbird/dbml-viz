/// <reference lib="webworker" />

import {
	extractDiagnostics,
	type SchemaParserRequest,
	type SchemaParserResponse,
} from "@/lib/parser-shared";
import { parseSchemaSource } from "@/lib/schema-source-parser";

const workerScope = self as DedicatedWorkerGlobalScope;

workerScope.addEventListener("error", (event) => {
	console.error("Schema parser web worker crashed.", event.error ?? event);
});

workerScope.addEventListener("unhandledrejection", (event) => {
	console.error(
		"Schema parser web worker rejected a promise without a handler.",
		event.reason,
	);
});

workerScope.addEventListener("message", (event: MessageEvent<SchemaParserRequest>) => {
	const { id, source } = event.data;

	void Promise.resolve()
		.then(() => parseSchemaSource(source))
		.then(({ parsed, metadata }) => {
			const response: SchemaParserResponse = {
				id,
				ok: true,
				parsed,
				metadata,
			};
			workerScope.postMessage(response);
		})
		.catch((error) => {
			console.error("Schema parser web worker parse failed.", error);

			const response: SchemaParserResponse = {
				id,
				ok: false,
				diagnostics: extractDiagnostics(error),
			};
			workerScope.postMessage(response);
		});
});
