import {
	SchemaParseError,
	type ParsedSourceResult,
} from "@/lib/parser-shared";
import { parseSchema } from "@/lib/parser";
import type { ParseDiagnostic, ParsedSchema, SchemaSourceMetadata } from "@/types";

interface ParseSuccess {
	readonly ok: true;
	readonly parsedSchema: ParsedSchema;
	readonly metadata: SchemaSourceMetadata;
}

interface ParseFailure {
	readonly ok: false;
	readonly diagnostics: readonly ParseDiagnostic[];
}

export type ParseResult = ParseSuccess | ParseFailure;

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
		return { ok: true, parsedSchema: parsed, metadata };
	} catch (error) {
		if (error instanceof SchemaParseError) {
			return { ok: false, diagnostics: error.diagnostics };
		}
		const message =
			error instanceof Error ? error.message : "Error parsing statement(s).";
		return { ok: false, diagnostics: [{ message }] };
	}
};
