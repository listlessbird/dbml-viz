/// <reference lib="webworker" />

import {
	extractDiagnostics,
	type DbmlParserRequest,
	type DbmlParserResponse,
} from "@/lib/parser-shared";
import { parseDbmlSource } from "@/lib/dbml-schema";

const workerScope = self as DedicatedWorkerGlobalScope;

workerScope.addEventListener("message", (event: MessageEvent<DbmlParserRequest>) => {
	const { id, dbml } = event.data;

	void Promise.resolve(parseDbmlSource(dbml))
		.then((parsed) => {
			const response: DbmlParserResponse = {
				id,
				ok: true,
				parsed,
			};
			workerScope.postMessage(response);
		})
		.catch((error) => {
			const response: DbmlParserResponse = {
				id,
				ok: false,
				diagnostics: extractDiagnostics(error),
			};
			workerScope.postMessage(response);
		});
});
