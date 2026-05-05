import {
	LanguageSupport,
	StreamLanguage,
	type StreamParser,
	type StringStream,
} from "@codemirror/language";

import type { SchemaSourceMetadata, SqlDialect } from "@/types";

interface DbmlTokenizerState {
	inBlockComment: boolean;
	expectDefinitionName: boolean;
}

type SqlGrammarDialect =
	| "postgres"
	| "mysql"
	| "mssql"
	| "plsql"
	| "standard";

const DEFINITION_KEYWORDS =
	/^(?:TableGroup|Table|Ref|Enum|Project)\b/i;
const KEYWORDS =
	/^(?:TableGroup|Table|Ref|Enum|Project|Note|indexes|headercolor|as|primary|key|pk|not\s+null|null|unique|default|increment|delete|update|color)\b/i;
const BOOLEANS = /^(?:true|false)\b/i;
const NUMBER = /^\d+(?:\.\d+)?\b/;
const IDENTIFIER = /^(?:[A-Za-z_][\w$]*)(?:\.[A-Za-z_][\w$]*)*/;
const QUOTED_IDENTIFIER = /^(?:`[^`\n]+`|"[^"\n]+"|\[[^\]\n]+\])/;
const OPERATOR = /^(?:<>|<=|>=|->|<-|::|[-=:+*/%<>])/;
const TYPE_NAME =
	/^(?:bigint|bigserial|bit|boolean|box|bytea|character(?:\s+varying)?|cidr|circle|date|double\s+precision|inet|int|integer|line|lseg|macaddr|money|oid|path|point|polygon|uuid|real|serial|smallint|sysdate|text|bit\s+varying|tinyint|var\s*char|float|interval|char|number|varchar\d?|numeric|decimal|time|timestamp)(?:\(\d+(?:,\d+)?\))?(?:\s+(?:with|without)\s+time\s+zone)?\b/i;

const readQuotedLiteral = (stream: StringStream, quote: string) => {
	let escaped = false;

	stream.next();

	while (!stream.eol()) {
		const char = stream.next();

		if (escaped) {
			escaped = false;
			continue;
		}

		if (char === "\\") {
			escaped = true;
			continue;
		}

		if (char === quote) {
			break;
		}
	}
};

const dbmlLanguage = new LanguageSupport(
	StreamLanguage.define<DbmlTokenizerState>({
		name: "dbml",
		startState: () => ({
			inBlockComment: false,
			expectDefinitionName: false,
		}),
		languageData: {
			commentTokens: {
				line: "//",
				block: {
					open: "/*",
					close: "*/",
				},
			},
			closeBrackets: {
				brackets: ["(", "[", "{", "'", '"', "`"],
			},
		},
		token(stream, state) {
			if (state.inBlockComment) {
				if (stream.skipTo("*/")) {
					stream.match("*/");
					state.inBlockComment = false;
				} else {
					stream.skipToEnd();
				}

				return "comment";
			}

			if (stream.eatSpace()) {
				return null;
			}

			if (state.expectDefinitionName) {
				const nextChar = stream.peek();
				if (nextChar && /[:{[(=<>-]/.test(nextChar)) {
					state.expectDefinitionName = false;
				}
			}

			if (stream.match("/*")) {
				state.inBlockComment = true;
				return "comment";
			}

			if (stream.match("//")) {
				stream.skipToEnd();
				state.expectDefinitionName = false;
				return "comment";
			}

			const nextChar = stream.peek();
			if (nextChar === '"' || nextChar === "'" || nextChar === "`") {
				readQuotedLiteral(stream, nextChar);
				state.expectDefinitionName = false;
				return "string";
			}

			if (stream.match(KEYWORDS)) {
				state.expectDefinitionName = DEFINITION_KEYWORDS.test(stream.current());
				return "keyword";
			}

			if (stream.match(TYPE_NAME)) {
				state.expectDefinitionName = false;
				return "typeName";
			}

			if (stream.match(BOOLEANS)) {
				state.expectDefinitionName = false;
				return "bool";
			}

			if (stream.match(NUMBER)) {
				state.expectDefinitionName = false;
				return "number";
			}

			if (stream.match(OPERATOR)) {
				state.expectDefinitionName = false;
				return "operator";
			}

			if (stream.match(/^[()[\]{},.:]/)) {
				if (stream.current() === ":") {
					state.expectDefinitionName = false;
				}

				return "punctuation";
			}

			if (stream.match(QUOTED_IDENTIFIER) || stream.match(IDENTIFIER)) {
				const tokenType = state.expectDefinitionName
					? "variableName.definition"
					: "variableName";
				state.expectDefinitionName = false;
				return tokenType;
			}

			state.expectDefinitionName = false;
			stream.next();
			return null;
		},
	} satisfies StreamParser<DbmlTokenizerState>),
);

const languageSupportCache = new Map<string, Promise<LanguageSupport>>();

export const resolveSqlGrammarDialect = (
	dialect: SqlDialect | undefined,
): SqlGrammarDialect => {
	switch (dialect) {
		case "mysql":
			return "mysql";
		case "mssql":
			return "mssql";
		case "oracle":
			return "plsql";
		case "snowflake":
			return "standard";
		case "postgres":
		default:
			return "postgres";
	}
};

export const getEditorLanguageCacheKey = (
	metadata: SchemaSourceMetadata,
) =>
	metadata.format === "dbml"
		? "dbml"
		: `sql:${resolveSqlGrammarDialect(metadata.dialect)}`;

const loadSqlLanguage = async (dialect: SqlGrammarDialect) => {
	const { MSSQL, MySQL, PLSQL, PostgreSQL, StandardSQL, sql } = await import(
		"@codemirror/lang-sql"
	);

	switch (dialect) {
		case "mysql":
			return sql({ dialect: MySQL });
		case "mssql":
			return sql({ dialect: MSSQL });
		case "plsql":
			return sql({ dialect: PLSQL });
		case "standard":
			return sql({ dialect: StandardSQL });
		case "postgres":
		default:
			return sql({ dialect: PostgreSQL });
	}
};

export const loadEditorLanguage = (
	metadata: SchemaSourceMetadata,
): Promise<LanguageSupport> => {
	const cacheKey = getEditorLanguageCacheKey(metadata);
	const cached = languageSupportCache.get(cacheKey);

	if (cached) {
		return cached;
	}

	const supportPromise =
		metadata.format === "dbml"
			? Promise.resolve(dbmlLanguage)
			: loadSqlLanguage(resolveSqlGrammarDialect(metadata.dialect));

	languageSupportCache.set(cacheKey, supportPromise);
	return supportPromise;
};
