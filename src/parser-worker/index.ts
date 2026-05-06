import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { initWorkersLogger } from "evlog/workers";
import { evlog, type EvlogVariables } from "evlog/hono";

import { extractDiagnostics } from "@/lib/parser-shared";

import { parseSchemaSource } from "./schema-source-parser";

initWorkersLogger({ env: { service: "dbml-viz-parser" } });

const parseRequestSchema = z.object({
	id: z.number(),
	source: z.string(),
});

const app = new Hono<EvlogVariables>()
	.use(evlog())
	.post("/api/parse", zValidator("json", parseRequestSchema), (c) => {
		const { id, source } = c.req.valid("json");
		const log = c.get("log");
		log.set({ parse: { requestId: id, sourceLength: source.length } });

		try {
			const { parsed, metadata, sourceRanges } = parseSchemaSource(source);
			log.set({
				parse: {
					format: metadata.format,
					tableCount: parsed.tables.length,
					refCount: parsed.refs.length,
				},
			});
			return c.json(
				{ id, ok: true as const, parsed, metadata, sourceRanges },
				200,
			);
		} catch (error) {
			const diagnostics = extractDiagnostics(error);
			log.set({ parse: { diagnosticCount: diagnostics.length } });
			log.error(error instanceof Error ? error : new Error(String(error)));
			return c.json({ id, ok: false as const, diagnostics }, 400);
		}
	});

export default app;
export type AppType = typeof app;
