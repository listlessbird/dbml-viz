import type {
	SchemaSourceMetadata,
	SqlDialect,
} from "@/types";

interface DbmlParseCandidate {
	readonly format: "dbml";
}

interface SqlParseCandidate {
	readonly format: "sql";
	readonly dialect: SqlDialect;
}

export type SchemaParseCandidate = DbmlParseCandidate | SqlParseCandidate;

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

export const toSchemaSourceMetadata = (
	candidate: SchemaParseCandidate,
): SchemaSourceMetadata =>
	candidate.format === "dbml"
		? {
				format: "dbml",
			}
		: {
				format: "sql",
				dialect: candidate.dialect,
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

export const getPreferredSourceMetadata = (
	source: string,
): SchemaSourceMetadata =>
	toSchemaSourceMetadata(getSchemaParseCandidates(source)[0] ?? { format: "dbml" });
