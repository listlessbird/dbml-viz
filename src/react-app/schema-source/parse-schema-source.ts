import {
	SchemaParseError,
	type ParsedSourceResult,
} from "@/lib/parser-shared";
import { parseSchema } from "@/lib/parser";
import type { ParseDiagnostic, ParsedSchema, SchemaSourceMetadata } from "@/types";

export interface ParseSuccess {
	readonly kind: "success";
	readonly parsedSchema: ParsedSchema;
	readonly metadata: SchemaSourceMetadata;
}

export interface ParseFailure {
	readonly kind: "failure";
	readonly diagnostics: readonly ParseDiagnostic[];
}

export interface ParseEmpty {
	readonly kind: "empty";
}

export type ParseResult = ParseSuccess | ParseFailure | ParseEmpty;

export const emptyParseResult: ParseEmpty = Object.freeze({ kind: "empty" });

export type ParseSchemaSourceFn = (source: string) => Promise<ParsedSourceResult>;

interface ParseSchemaSourceOptions {
	readonly parser?: ParseSchemaSourceFn;
}

export const parseSchemaSource = async (
	source: string,
	options: ParseSchemaSourceOptions = {},
): Promise<ParseResult> => {
	const parser = options.parser ?? parseSchema;
	try {
		const { parsed, metadata } = await parser(source);
		return { kind: "success", parsedSchema: parsed, metadata };
	} catch (error) {
		if (error instanceof SchemaParseError) {
			return { kind: "failure", diagnostics: error.diagnostics };
		}
		const message =
			error instanceof Error ? error.message : "Error parsing statement(s).";
		return { kind: "failure", diagnostics: [{ message }] };
	}
};
