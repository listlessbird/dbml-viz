import type {
	ParseDiagnostic,
	ParsedSchema,
	SchemaSourceMetadata,
} from "@/types";

export const EMPTY_SCHEMA: ParsedSchema = {
	tables: [],
	refs: [],
	errors: [],
};

export interface ParsedSourceResult {
	readonly parsed: ParsedSchema;
	readonly metadata: SchemaSourceMetadata;
}

export class SchemaParseError extends Error {
	readonly diagnostics: readonly ParseDiagnostic[];

	constructor(diagnostics: readonly ParseDiagnostic[]) {
		super("Error parsing statement(s).");
		this.name = "SchemaParseError";
		this.diagnostics = diagnostics;
	}
}

const hasDiagnosticsArray = (error: unknown): error is { diags: unknown[] } =>
	typeof error === "object" &&
	error !== null &&
	"diags" in error &&
	Array.isArray(error.diags);

const readDiagnosticMessage = (diagnostic: unknown) =>
	typeof diagnostic === "object" &&
	diagnostic !== null &&
	"message" in diagnostic &&
	typeof diagnostic.message === "string"
		? diagnostic.message
		: "Error parsing statement(s).";

const readDiagnosticCode = (diagnostic: unknown) =>
	typeof diagnostic === "object" &&
	diagnostic !== null &&
	"code" in diagnostic &&
	typeof diagnostic.code === "number"
		? diagnostic.code
		: undefined;

const readDiagnosticLocation = (
	diagnostic: unknown,
): ParseDiagnostic["location"] | undefined => {
	if (
		typeof diagnostic !== "object" ||
		diagnostic === null ||
		!("location" in diagnostic) ||
		typeof diagnostic.location !== "object" ||
		diagnostic.location === null ||
		!("start" in diagnostic.location) ||
		typeof diagnostic.location.start !== "object" ||
		diagnostic.location.start === null ||
		!("line" in diagnostic.location.start) ||
		!("column" in diagnostic.location.start) ||
		typeof diagnostic.location.start.line !== "number" ||
		typeof diagnostic.location.start.column !== "number"
	) {
		return undefined;
	}

	const end =
		"end" in diagnostic.location &&
		typeof diagnostic.location.end === "object" &&
		diagnostic.location.end !== null &&
		"line" in diagnostic.location.end &&
		"column" in diagnostic.location.end &&
		typeof diagnostic.location.end.line === "number" &&
		typeof diagnostic.location.end.column === "number"
			? {
					line: diagnostic.location.end.line,
					column: diagnostic.location.end.column,
				}
			: undefined;

	return {
		start: {
			line: diagnostic.location.start.line,
			column: diagnostic.location.start.column,
		},
		...(end !== undefined ? { end } : {}),
	};
};

/**
 * @dbml/core throws errors with an untyped `.diags` array.
 * This extracts structured diagnostics from that format.
 */
export const extractDiagnostics = (error: unknown): ParseDiagnostic[] => {
	if (hasDiagnosticsArray(error)) {
		return error.diags.map((diagnostic) => {
			const code = readDiagnosticCode(diagnostic);
			const location = readDiagnosticLocation(diagnostic);

			return {
				message: readDiagnosticMessage(diagnostic),
				...(code !== undefined ? { code } : {}),
				...(location !== undefined ? { location } : {}),
			};
		});
	}

	return [
		{
			message: error instanceof Error ? error.message : "Error parsing statement(s).",
		},
	];
};
