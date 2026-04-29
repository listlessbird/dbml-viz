import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

import { extractDiagnostics } from "@/lib/parser-shared";

import { parseSchemaSource } from "./schema-source-parser";

const parseRequestSchema = z.object({
	id: z.number(),
	source: z.string(),
});

const app = new Hono().post(
	"/api/parse",
	zValidator("json", parseRequestSchema),
	(c) => {
		const { id, source } = c.req.valid("json");

		try {
			const { parsed, metadata } = parseSchemaSource(source);
			return c.json({ id, ok: true as const, parsed, metadata }, 200);
		} catch (error) {
			console.error("error parsing dbml", error);
			return c.json(
				{ id, ok: false as const, diagnostics: extractDiagnostics(error) },
				400,
			);
		}
	},
);

export default app;
export type AppType = typeof app;
