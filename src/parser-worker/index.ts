import {
	extractDiagnostics,
	type SchemaParserRequest,
	type SchemaParserResponse,
} from "../react-app/lib/parser-shared";
import { parseSchemaSource } from "../react-app/lib/schema-source-parser";

const json = (body: unknown, init?: ResponseInit) =>
	new Response(JSON.stringify(body), {
		...init,
		headers: {
			"content-type": "application/json; charset=utf-8",
			...init?.headers,
		},
	});

const readParseRequest = async (request: Request): Promise<SchemaParserRequest | null> => {
	const body = await request.json();
	if (
		typeof body !== "object" ||
		body === null ||
		!("id" in body) ||
		typeof body.id !== "number" ||
		!("source" in body) ||
		typeof body.source !== "string"
	) {
		return null;
	}

	return {
		id: body.id,
		source: body.source,
	};
};

export default {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		if (request.method !== "POST" || url.pathname !== "/api/parse") {
			return json({ error: "Not found." }, { status: 404 });
		}

		let parseRequest: SchemaParserRequest | null;
		try {
			parseRequest = await readParseRequest(request);
		} catch {
			return json({ error: "Request body must be JSON." }, { status: 400 });
		}

		if (parseRequest === null) {
			return json(
				{ error: "Request body must include a numeric id and string source." },
				{ status: 400 },
			);
		}

		try {
			const { parsed, metadata } = parseSchemaSource(parseRequest.source);
			const response: SchemaParserResponse = {
				id: parseRequest.id,
				ok: true,
				parsed,
				metadata,
			};
			return json(response);
		} catch (error) {
			console.error("error parsing dbml", error);
			const response: SchemaParserResponse = {
				id: parseRequest.id,
				ok: false,
				diagnostics: extractDiagnostics(error),
			};
			return json(response, { status: 400 });
		}
	},
} satisfies ExportedHandler;
