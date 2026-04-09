import { describe, expect, it } from "vitest";

import {
	getEditorLanguageCacheKey,
	loadEditorLanguage,
	resolveSqlGrammarDialect,
} from "@/lib/editor-language";

describe("editor-language", () => {
	it("maps app dialects to the closest CodeMirror SQL grammar", () => {
		expect(resolveSqlGrammarDialect("postgres")).toBe("postgres");
		expect(resolveSqlGrammarDialect("mysql")).toBe("mysql");
		expect(resolveSqlGrammarDialect("mssql")).toBe("mssql");
		expect(resolveSqlGrammarDialect("oracle")).toBe("plsql");
		expect(resolveSqlGrammarDialect("snowflake")).toBe("standard");
	});

	it("uses stable cache keys for lazy-loaded language supports", () => {
		expect(getEditorLanguageCacheKey({ format: "dbml" })).toBe("dbml");
		expect(getEditorLanguageCacheKey({ format: "sql", dialect: "mysql" })).toBe(
			"sql:mysql",
		);
		expect(getEditorLanguageCacheKey({ format: "sql", dialect: "oracle" })).toBe(
			"sql:plsql",
		);
	});

	it("reuses cached language supports", async () => {
		const dbmlSupport = await loadEditorLanguage({ format: "dbml" });
		const cachedDbmlSupport = await loadEditorLanguage({ format: "dbml" });
		const sqlSupport = await loadEditorLanguage({ format: "sql", dialect: "mysql" });
		const cachedSqlSupport = await loadEditorLanguage({
			format: "sql",
			dialect: "mysql",
		});

		expect(cachedDbmlSupport).toBe(dbmlSupport);
		expect(dbmlSupport.language.name).toBe("dbml");
		expect(cachedSqlSupport).toBe(sqlSupport);
	});
});
