import {
	DbmlParseError,
	EMPTY_SCHEMA,
	type DbmlParserRequest,
	type DbmlParserResponse,
} from "@/lib/parser-shared";
import type { ParsedSchema } from "@/types";

export { DbmlParseError } from "@/lib/parser-shared";

const PARSER_WORKER_IDLE_TIMEOUT_MS = 20_000;

let parserWorker: Worker | null = null;
let nextRequestId = 0;
let idleTimerId: number | null = null;

const pendingParses = new Map<
	number,
	{
		resolve: (value: ParsedSchema) => void;
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

const handleParserWorkerMessage = (event: MessageEvent<DbmlParserResponse>) => {
	const pending = pendingParses.get(event.data.id);
	if (!pending) {
		return;
	}

	pendingParses.delete(event.data.id);

	if (event.data.ok) {
		pending.resolve(event.data.parsed);
	} else {
		pending.reject(new DbmlParseError(event.data.diagnostics));
	}

	scheduleIdleTermination();
};

const ensureParserWorker = () => {
	clearIdleTermination();

	if (parserWorker !== null) {
		return parserWorker;
	}

	const worker = new Worker(new URL("../workers/dbml-parser.worker.ts", import.meta.url), {
		type: "module",
	});

	worker.addEventListener("message", handleParserWorkerMessage);
	worker.addEventListener("error", () => {
		terminateParserWorker(new Error("DBML parser worker crashed."));
	});
	worker.addEventListener("messageerror", () => {
		terminateParserWorker(new Error("DBML parser worker returned an invalid message."));
	});

	parserWorker = worker;
	return worker;
};

export const parseDbml = (dbml: string): Promise<ParsedSchema> => {
	if (dbml.trim().length === 0) {
		return Promise.resolve(EMPTY_SCHEMA);
	}

	const worker = ensureParserWorker();
	const requestId = ++nextRequestId;

	return new Promise<ParsedSchema>((resolve, reject) => {
		pendingParses.set(requestId, { resolve, reject });

		const request: DbmlParserRequest = {
			id: requestId,
			dbml,
		};

		worker.postMessage(request);
	});
};
