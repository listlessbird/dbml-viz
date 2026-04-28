import {
	SchemaParseError,
	EMPTY_SCHEMA,
	type SchemaParserResponse,
} from "@/lib/parser-shared";
import type { ParsedSourceResult } from "@/lib/schema-source-parser";

export { SchemaParseError } from "@/lib/parser-shared";

let nextRequestId = 0;

const isParserSuccess = (
	payload: Partial<SchemaParserResponse>,
	requestId: number,
): payload is Extract<SchemaParserResponse, { ok: true }> =>
	payload.id === requestId &&
	payload.ok === true &&
	payload.parsed !== undefined &&
	payload.metadata !== undefined;

const isParserError = (
	payload: Partial<SchemaParserResponse>,
	requestId: number,
): payload is Extract<SchemaParserResponse, { ok: false }> =>
	payload.id === requestId &&
	payload.ok === false &&
	payload.diagnostics !== undefined;

export const parseSchema = (source: string): Promise<ParsedSourceResult> => {
	if (source.trim().length === 0) {
		return Promise.resolve({
			parsed: EMPTY_SCHEMA,
			metadata: {
				format: "dbml",
			},
		});
	}

	const requestId = ++nextRequestId;

	return fetch("/api/parse", {
		method: "POST",
		headers: {
			"content-type": "application/json",
		},
		body: JSON.stringify({ id: requestId, source }),
	})
		.then(async (response) => {
			const payload = (await response.json()) as Partial<SchemaParserResponse>;
			return { response, payload };
		})
		.then(({ response, payload }) => {
			if (isParserSuccess(payload, requestId)) {
				return {
					parsed: payload.parsed,
					metadata: payload.metadata,
				};
			}

			if (isParserError(payload, requestId)) {
				throw new SchemaParseError(payload.diagnostics);
			}

			throw new Error(
				payload.id !== requestId
					? "Schema parser returned a mismatched response."
					: response.ok
					? "Schema parser returned an invalid response."
					: "Schema parser request failed.",
			);
		})
		.catch((error) => {
			if (error instanceof SchemaParseError) {
				throw error;
			}

			throw new Error(
				error instanceof Error ? error.message : "Unable to reach schema parser.",
			);
		});
};
