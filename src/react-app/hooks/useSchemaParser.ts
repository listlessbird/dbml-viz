import { useEffect, useReducer } from "react";

import {
	getPreferredSourceMetadata,
	hasSameSourceMetadata,
} from "@/lib/schema-source-detection";
import { parseSchema, SchemaParseError } from "@/lib/parser";
import type {
	ParseDiagnostic,
	ParsedSchema,
	SchemaSourceMetadata,
} from "@/types";

const EMPTY_SCHEMA: ParsedSchema = {
	tables: [],
	refs: [],
	errors: [],
};

interface ParsedMetadataState {
	readonly source: string;
	readonly metadata: SchemaSourceMetadata;
}

interface SchemaParserState {
	readonly parsed: ParsedSchema;
	readonly diagnostics: readonly ParseDiagnostic[];
	readonly isParsing: boolean;
	readonly parsedMetadata: ParsedMetadataState | null;
}

type SchemaParserAction =
	| { readonly type: "start-parse" }
	| {
			readonly type: "parse-success";
			readonly source: string;
			readonly parsed: ParsedSchema;
			readonly metadata: SchemaSourceMetadata;
	  }
	| {
			readonly type: "parse-error";
			readonly diagnostics: readonly ParseDiagnostic[];
	  };

const INITIAL_SCHEMA_PARSER_STATE: SchemaParserState = {
	parsed: EMPTY_SCHEMA,
	diagnostics: [],
	isParsing: false,
	parsedMetadata: null,
};

const schemaParserReducer = (
	state: SchemaParserState,
	action: SchemaParserAction,
): SchemaParserState => {
	switch (action.type) {
		case "start-parse":
			return state.isParsing ? state : { ...state, isParsing: true };
		case "parse-success":
			return {
				parsed: action.parsed,
				diagnostics: [],
				isParsing: false,
				parsedMetadata:
					state.parsedMetadata !== null &&
					state.parsedMetadata.source === action.source &&
					hasSameSourceMetadata(state.parsedMetadata.metadata, action.metadata)
						? state.parsedMetadata
						: {
								source: action.source,
								metadata: action.metadata,
							},
			};
		case "parse-error":
			return {
				...state,
				diagnostics: action.diagnostics,
				isParsing: false,
			};
	}
};

export const useSchemaParser = (source: string, delay = 300) => {
	const [state, dispatch] = useReducer(
		schemaParserReducer,
		INITIAL_SCHEMA_PARSER_STATE,
	);
	const heuristicMetadata = getPreferredSourceMetadata(source);
	const metadata =
		state.parsedMetadata !== null && state.parsedMetadata.source === source
			? state.parsedMetadata.metadata
			: heuristicMetadata;

	useEffect(() => {
		let cancelled = false;

		const timeoutId = window.setTimeout(() => {
			dispatch({ type: "start-parse" });
			void parseSchema(source)
				.then(({ parsed: nextParsed, metadata: nextMetadata }) => {
					if (cancelled) {
						return;
					}

					dispatch({
						type: "parse-success",
						source,
						parsed: nextParsed,
						metadata: nextMetadata,
					});
				})
				.catch((error) => {
					if (cancelled) {
						return;
					}

					console.error(error);

					const diagnostics =
						error instanceof SchemaParseError
							? [...error.diagnostics]
							: [
									{
										message:
											error instanceof Error
												? error.message
												: "Unable to parse schema source.",
									},
								];

					dispatch({
						type: "parse-error",
						diagnostics,
					});
				});
			}, delay);

		return () => {
			cancelled = true;
			window.clearTimeout(timeoutId);
		};
	}, [source, delay]);

	return {
		parsed: state.parsed,
		diagnostics: state.diagnostics,
		isParsing: state.isParsing,
		metadata,
	};
};
