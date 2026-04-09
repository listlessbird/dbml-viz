import {
	SchemaParseError,
	EMPTY_SCHEMA,
	type SchemaParserRequest,
	type SchemaParserResponse,
} from "@/lib/parser-shared";
import type { ParsedSourceResult } from "@/lib/schema-source-parser";

export { SchemaParseError } from "@/lib/parser-shared";

const PARSER_WORKER_IDLE_TIMEOUT_MS = 20_000;

let parserWorker: Worker | null = null;
let nextRequestId = 0;
let idleTimerId: number | null = null;

const pendingParses = new Map<
	number,
	{
		resolve: (value: ParsedSourceResult) => void;
		reject: (reason?: unknown) => void;
	}
>();

const clearIdleTermination = () => {
	if (idleTimerId !== null) {
		window.clearTimeout(idleTimerId);
		idleTimerId = null;
	}
};

const rejectPendingParses = (error: Error) => {
	for (const { reject } of pendingParses.values()) {
		reject(error);
	}
	pendingParses.clear();
};

const terminateParserWorker = (error?: Error) => {
	clearIdleTermination();

	if (parserWorker !== null) {
		parserWorker.terminate();
		parserWorker = null;
	}

	if (error) {
		rejectPendingParses(error);
	}
};

const scheduleIdleTermination = () => {
	clearIdleTermination();

	if (parserWorker === null || pendingParses.size > 0) {
		return;
	}

	idleTimerId = window.setTimeout(() => {
		if (pendingParses.size === 0) {
			terminateParserWorker();
		}
	}, PARSER_WORKER_IDLE_TIMEOUT_MS);
};

const handleParserWorkerMessage = (event: MessageEvent<SchemaParserResponse>) => {
	const pending = pendingParses.get(event.data.id);
	if (!pending) {
		return;
	}

	pendingParses.delete(event.data.id);

	if (event.data.ok) {
		pending.resolve({
			parsed: event.data.parsed,
			metadata: event.data.metadata,
		});
	} else {
		pending.reject(new SchemaParseError(event.data.diagnostics));
	}

	scheduleIdleTermination();
};

const ensureParserWorker = () => {
	clearIdleTermination();

	if (parserWorker !== null) {
		return parserWorker;
	}

	const worker = new Worker(new URL("../workers/schema-parser.worker.ts", import.meta.url), {
		type: "module",
	});

	worker.addEventListener("message", handleParserWorkerMessage);
	worker.addEventListener("error", (event) => {
		console.error("Schema parser web worker crashed.", event.error ?? event);

		terminateParserWorker(new Error("Schema parser worker crashed."));
	});
	worker.addEventListener("messageerror", (event) => {
		console.error("Schema parser web worker returned an invalid message.", event);

		terminateParserWorker(new Error("Schema parser worker returned an invalid message."));
	});

	parserWorker = worker;
	return worker;
};

export const parseSchema = (source: string): Promise<ParsedSourceResult> => {
	if (source.trim().length === 0) {
		return Promise.resolve({
			parsed: EMPTY_SCHEMA,
			metadata: {
				format: "dbml",
			},
		});
	}

	const worker = ensureParserWorker();
	const requestId = ++nextRequestId;

	return new Promise<ParsedSourceResult>((resolve, reject) => {
		pendingParses.set(requestId, { resolve, reject });

		const request: SchemaParserRequest = {
			id: requestId,
			source,
		};

		worker.postMessage(request);
	});
};
