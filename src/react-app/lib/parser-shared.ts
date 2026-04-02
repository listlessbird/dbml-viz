import type { ParseDiagnostic, ParsedSchema } from "@/types";

export const EMPTY_SCHEMA: ParsedSchema = {
	tables: [],
	refs: [],
	errors: [],
};

export class DbmlParseError extends Error {
	readonly diagnostics: readonly ParseDiagnostic[];

	constructor(diagnostics: readonly ParseDiagnostic[]) {
		super("Error parsing statement(s).");
		this.name = "DbmlParseError";
		this.diagnostics = diagnostics;
	}
}

export interface DbmlParserRequest {
	readonly id: number;
	readonly dbml: string;
}

export interface DbmlParserSuccessResponse {
	readonly id: number;
	readonly ok: true;
	readonly parsed: ParsedSchema;
}

export interface DbmlParserErrorResponse {
	readonly id: number;
	readonly ok: false;
	readonly diagnostics: readonly ParseDiagnostic[];
}

export type DbmlParserResponse =
	| DbmlParserSuccessResponse
	| DbmlParserErrorResponse;

export const normalizeDiagnostics = (error: unknown): ParseDiagnostic[] => {
	if (
		typeof error === "object" &&
		error !== null &&
		"diags" in error &&
		Array.isArray(error.diags)
	) {
		return error.diags.map((diag) => ({
			message:
				typeof diag?.message === "string" ? diag.message : "Error parsing statement(s).",
			code: typeof diag?.code === "number" ? diag.code : undefined,
			location:
				diag?.location &&
				typeof diag.location === "object" &&
				diag.location.start &&
				typeof diag.location.start.line === "number" &&
				typeof diag.location.start.column === "number"
					? {
							start: {
								line: diag.location.start.line,
								column: diag.location.start.column,
							},
							end:
								diag.location.end &&
								typeof diag.location.end.line === "number" &&
								typeof diag.location.end.column === "number"
									? {
											line: diag.location.end.line,
											column: diag.location.end.column,
										}
									: undefined,
						}
					: undefined,
		}));
	}

	return [
		{
			message: error instanceof Error ? error.message : "Error parsing statement(s).",
		},
	];
};
