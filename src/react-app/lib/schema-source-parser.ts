import { Parser } from "@dbml/core";

import { buildParsedSchemaFromDatabase, parseDbmlSource } from "@/lib/dbml-schema";
import { EMPTY_SCHEMA, extractDiagnostics } from "@/lib/parser-shared";
import type {
	ParsedSchema,
	ParseDiagnostic,
	SchemaSourceFormat,
	SqlDialect,
} from "@/types";

interface DbmlParseCandidate {
	readonly format: "dbml";
}

interface SqlParseCandidate {
	readonly format: "sql";
	readonly dialect: SqlDialect;
}

type SchemaParseCandidate = DbmlParseCandidate | SqlParseCandidate;

interface FailedParseAttempt {
	readonly candidate: SchemaParseCandidate;
	readonly diagnostics: readonly ParseDiagnostic[];
	readonly error: unknown;
}

export interface ParsedSourceMetadata {
	readonly format: SchemaSourceFormat;
	readonly dialect?: SqlDialect;
}

export interface ParsedSourceResult {
	readonly parsed: ParsedSchema;
	readonly metadata: ParsedSourceMetadata;
}

const SQL_DIALECTS = [
	"postgres",
	"mysql",
	"mssql",
	"oracle",
	"snowflake",
] as const satisfies readonly SqlDialect[];

const DBML_HINT_PATTERNS = [
	/^\s*Table(?:Group)?\b/im,
	/^\s*Ref\b/im,
	/^\s*Enum\b/im,
	/^\s*Project\b/im,
	/\bindexes\s*\{/i,
	/\[[^\]\n]*(?:pk|not null|unique|note:)[^\]\n]*\]/i,
] as const satisfies readonly RegExp[];

const SQL_HINT_PATTERNS = [
	/^\s*create\b/im,
	/^\s*alter\b/im,
	/\bprimary\s+key\b/i,
	/\bforeign\s+key\b/i,
	/\breferences\b/i,
	/\bconstraint\b/i,
] as const satisfies readonly RegExp[];

const DIALECT_HINT_PATTERNS = {
	postgres: [/\bserial\b/i, /\bbigserial\b/i, /\bjsonb\b/i, /\bgen_random_uuid\s*\(/i],
	mysql: [/\bengine\s*=/i, /\bauto_increment\b/i, /`[^`\n]+`/, /\bunsigned\b/i],
	mssql: [/\bidentity\s*\(/i, /\bnvarchar\b/i, /\[[^\]\n]+\]/, /\bdbo\./i],
	oracle: [/\bvarchar2\b/i, /\bnumber\b/i, /\busing\s+index\b/i, /\benable\b/i],
	snowflake: [/\bvariant\b/i, /\btransient\b/i, /\bcluster\s+by\b/i, /\btimestamp_ntz\b/i],
} as const satisfies Record<SqlDialect, readonly RegExp[]>;

const countPatternMatches = (
	source: string,
	patterns: readonly RegExp[],
) => patterns.reduce((score, pattern) => score + (pattern.test(source) ? 1 : 0), 0);

const compareDialectCandidates = (
	source: string,
	left: SqlDialect,
	right: SqlDialect,
) => {
	const leftScore = countPatternMatches(source, DIALECT_HINT_PATTERNS[left]);
	const rightScore = countPatternMatches(source, DIALECT_HINT_PATTERNS[right]);

	return rightScore - leftScore;
};

export const getSchemaParseCandidates = (
	source: string,
): readonly SchemaParseCandidate[] => {
	const dbmlScore = countPatternMatches(source, DBML_HINT_PATTERNS);
	const sqlScore = countPatternMatches(source, SQL_HINT_PATTERNS);
	const sqlCandidates = [...SQL_DIALECTS]
		.sort((left, right) => compareDialectCandidates(source, left, right))
		.map((dialect) => ({ format: "sql", dialect }) satisfies SqlParseCandidate);

	if (source.trim().length === 0) {
		return [{ format: "dbml" }];
	}

	if (sqlScore > dbmlScore) {
		return [...sqlCandidates, { format: "dbml" }];
	}

	return [{ format: "dbml" }, ...sqlCandidates];
};

const parseWithCandidate = (
	source: string,
	candidate: SchemaParseCandidate,
): ParsedSourceResult => {
	if (candidate.format === "dbml") {
		return {
			parsed: parseDbmlSource(source),
			metadata: {
				format: "dbml",
			},
		};
	}

	return {
		parsed: buildParsedSchemaFromDatabase(Parser.parse(source, candidate.dialect)),
		metadata: {
			format: "sql",
			dialect: candidate.dialect,
		},
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
			metadata: {
				format: "dbml",
			},
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
