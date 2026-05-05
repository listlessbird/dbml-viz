import { hc } from "hono/client";

import {
	SchemaParseError,
	EMPTY_SCHEMA,
	type ParsedSourceResult,
} from "@/lib/parser-shared";
import type { AppType } from "../../parser-worker";

const client = hc<AppType>("/");

let nextRequestId = 0;

export const parseSchema = async (source: string): Promise<ParsedSourceResult> => {
	if (source.trim().length === 0) {
		return {
			parsed: EMPTY_SCHEMA,
			metadata: { format: "dbml" },
		};
	}

	const requestId = ++nextRequestId;

	let response: Awaited<ReturnType<typeof client.api.parse.$post>>;
	try {
		response = await client.api.parse.$post({
			json: { id: requestId, source },
		});
	} catch (error) {
		throw new Error(
			error instanceof Error ? error.message : "Unable to reach schema parser.",
		);
	}

	if (response.status === 200) {
		const payload = await response.json();
		if (payload.id !== requestId) {
			throw new Error("Schema parser returned a mismatched response.");
		}
		return {
			parsed: payload.parsed,
			metadata: payload.metadata,
		};
	}

	if (response.status === 400) {
		const payload = await response.json();
		if (payload.id !== requestId) {
			throw new Error("Schema parser returned a mismatched response.");
		}
		if ("ok" in payload && payload.ok === false) {
			throw new SchemaParseError(payload.diagnostics);
		}
		throw new Error("Schema parser returned an invalid response.");
	}

	throw new Error("Schema parser request failed.");
};
