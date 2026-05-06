import { Result, TaggedError } from "better-result";
import { log } from "evlog";
import { hc, type InferResponseType } from "hono/client";

import type { AppType as ParserAppType } from "../../parser-worker";

type ParserServiceClient = ReturnType<typeof hc<ParserAppType>>;
type ParseEndpoint = ParserServiceClient["api"]["parse"]["$post"];
type ParseSuccess = InferResponseType<ParseEndpoint, 200>;
type ParseFailure = Extract<InferResponseType<ParseEndpoint, 400>, { ok: false }>;

export type ParserParsedSchema = ParseSuccess["parsed"];
export type ParserDiagnostic = ParseFailure["diagnostics"][number];
export type ParserSourceRanges = NonNullable<ParseSuccess["sourceRanges"]>;

const PARSER_UNAVAILABLE_MESSAGE =
	"Schema parsing is currently unavailable. Please retry shortly.";
const PARSER_SYNTAX_MESSAGE = "Schema source could not be parsed.";

export class ParserUnreachableError extends TaggedError("ParserUnreachableError")<{
	readonly message: string;
}>() {
	constructor() {
		super({ message: PARSER_UNAVAILABLE_MESSAGE });
	}
}

export class ParserSyntaxError extends TaggedError("ParserSyntaxError")<{
	readonly message: string;
	readonly diagnostics: readonly ParserDiagnostic[];
}>() {
	constructor(diagnostics: readonly ParserDiagnostic[]) {
		super({ message: PARSER_SYNTAX_MESSAGE, diagnostics });
	}
}

export class ParserInvalidResponseError extends TaggedError(
	"ParserInvalidResponseError",
)<{
	readonly message: string;
}>() {
	constructor() {
		super({ message: PARSER_UNAVAILABLE_MESSAGE });
	}
}

export type ParserClientError =
	| ParserUnreachableError
	| ParserSyntaxError
	| ParserInvalidResponseError;

export interface ParserParseOk {
	readonly parsed: ParseSuccess["parsed"];
	readonly metadata: ParseSuccess["metadata"];
	readonly sourceRanges: ParserSourceRanges | null;
}

export interface ParserClient {
	readonly parseSchemaSource: (
		source: string,
	) => Promise<Result<ParserParseOk, ParserClientError>>;
}

let nextRequestId = 0;

export const createParserClient = ({
	parserService,
}: {
	readonly parserService: { readonly fetch: typeof fetch };
}): ParserClient => {
	const client = hc<ParserAppType>("https://parser.internal/", {
		fetch: parserService.fetch.bind(parserService),
	});

	return {
		parseSchemaSource: async (source) => {
			const requestId = ++nextRequestId;

			let response;
			try {
				response = await client.api.parse.$post({
					json: { id: requestId, source },
				});
			} catch (cause) {
				log.error({
					scope: "parser_client",
					op: "fetch",
					requestId,
					sourceLength: source.length,
					cause: cause instanceof Error ? cause.message : String(cause),
				});
				return Result.err(new ParserUnreachableError());
			}

			if (response.status === 200) {
				const payload = await response.json();
				return Result.ok({
					parsed: payload.parsed,
					metadata: payload.metadata,
					sourceRanges: payload.sourceRanges ?? null,
				});
			}

			if (response.status === 400) {
				const payload = await response.json();
				if (payload.ok === false) {
					return Result.err(new ParserSyntaxError(payload.diagnostics));
				}
			}

			log.error({
				scope: "parser_client",
				op: "unexpected_status",
				requestId,
				sourceLength: source.length,
				status: response.status,
			});
			return Result.err(new ParserInvalidResponseError());
		},
	};
};
