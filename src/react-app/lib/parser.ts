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

let activeParseId: number | null = null;
let nextParse: {
	source: string;
	resolve: (value: ParsedSourceResult) => void;
	reject: (reason?: unknown) => void;
} | null = null;

const processNextParse = () => {
	if (activeParseId !== null || nextParse === null) {
		return;
	}

	const { source, resolve, reject } = nextParse;
	nextParse = null;

	const worker = ensureParserWorker();
	const requestId = ++nextRequestId;
	activeParseId = requestId;

	pendingParses.set(requestId, { resolve, reject });
	const request: SchemaParserRequest = {
		id: requestId,
		source,
	};
	worker.postMessage(request);
};

const handleParserWorkerMessage = (event: MessageEvent<SchemaParserResponse>) => {
	if (activeParseId === event.data.id) {
		activeParseId = null;
	}

	const pending = pendingParses.get(event.data.id);
	if (!pending) {
		processNextParse();
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
	processNextParse();
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
		activeParseId = null;
		terminateParserWorker(new Error("Schema parser worker crashed."));
		processNextParse();
	});
	worker.addEventListener("messageerror", (event) => {
		console.error("Schema parser web worker returned an invalid message.", event);
		activeParseId = null;
		terminateParserWorker(new Error("Schema parser worker returned an invalid message."));
		processNextParse();
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

	return new Promise<ParsedSourceResult>((resolve, reject) => {
		if (nextParse !== null) {
			nextParse.reject(new Error("Parse cancelled by newer request."));
		}

		nextParse = { source, resolve, reject };
		processNextParse();
	});
};
