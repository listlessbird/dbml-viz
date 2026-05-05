import { Parser } from "@dbml/core";

import {
	EMPTY_SCHEMA,
	extractDiagnostics,
	type ParsedSourceResult,
} from "@/lib/parser-shared";
import {
	getPreferredSourceMetadata,
	getSchemaParseCandidates,
	toSchemaSourceMetadata,
	type SchemaParseCandidate,
} from "@/lib/schema-source-detection";
import type { ParseDiagnostic } from "@/types";

import { buildParsedSchemaFromDatabase, parseDbmlSource } from "./dbml-schema";

interface FailedParseAttempt {
	readonly candidate: SchemaParseCandidate;
	readonly diagnostics: readonly ParseDiagnostic[];
	readonly error: unknown;
}

const parseWithCandidate = (
	source: string,
	candidate: SchemaParseCandidate,
): ParsedSourceResult => {
	if (candidate.format === "dbml") {
		return {
			parsed: parseDbmlSource(source),
			metadata: toSchemaSourceMetadata(candidate),
		};
	}

	return {
		parsed: buildParsedSchemaFromDatabase(Parser.parse(source, candidate.dialect)),
		metadata: toSchemaSourceMetadata(candidate),
	};
};

const diagnosticLocationScore = (diagnostic: ParseDiagnostic) => {
	const line = diagnostic.location?.start.line ?? 0;
	const column = diagnostic.location?.start.column ?? 0;
	return line * 10_000 + column;
};

const getBestFailedAttempt = (attempts: readonly FailedParseAttempt[]) =>
	attempts.reduce<FailedParseAttempt | null>((bestAttempt, attempt) => {
		if (bestAttempt === null) {
			return attempt;
		}

		const bestScore = Math.max(
			0,
			...bestAttempt.diagnostics.map(diagnosticLocationScore),
		);
		const attemptScore = Math.max(0, ...attempt.diagnostics.map(diagnosticLocationScore));

		return attemptScore > bestScore ? attempt : bestAttempt;
	}, null);

export const parseSchemaSource = (source: string): ParsedSourceResult => {
	if (source.trim().length === 0) {
		return {
			parsed: EMPTY_SCHEMA,
			metadata: getPreferredSourceMetadata(source),
		};
	}

	const failures: FailedParseAttempt[] = [];

	for (const candidate of getSchemaParseCandidates(source)) {
		try {
			return parseWithCandidate(source, candidate);
		} catch (error) {
			failures.push({
				candidate,
				diagnostics: extractDiagnostics(error),
				error,
			});
		}
	}

	throw getBestFailedAttempt(failures)?.error ?? new Error("Error parsing statement(s).");
};

export { getSchemaParseCandidates } from "@/lib/schema-source-detection";
