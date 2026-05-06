import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { nanoid } from "nanoid";
import { z } from "zod";
import { initWorkersLogger } from "evlog/workers";
import { evlog, type EvlogVariables } from "evlog/hono";

import {
	SHARE_TTL_SECONDS,
	sharedSchemaPayloadSchema,
	type ShareErrorResponse,
} from "./domain/schema-share";
import { callWorkspace } from "./lib/call-workspace";

initWorkersLogger({ env: { service: "dbml-viz" } });

const loadParamsSchema = z.object({
	id: z.string().min(1, "A shared schema id is required."),
});

const validationError = (message: string) =>
	({ error: message }) satisfies ShareErrorResponse;

export const app = new Hono<{ Bindings: Env } & EvlogVariables>()
	.use(evlog())
	.get("/api/health", (c) => c.json({ ok: true as const }, 200))
	.all("/api/parse", (c) => c.env.SCHEMA_PARSER.fetch(c.req.raw))
	.all("/api/agent/:workspaceId/ws", (c) =>
		callWorkspace(c.env, c.req.param("workspaceId"), (stub) =>
			stub.fetch(c.req.raw),
		),
	)
	.all("/api/agent/:workspaceId/mcp/*", (c) =>
		callWorkspace(c.env, c.req.param("workspaceId"), (stub) =>
			stub.fetch(c.req.raw),
		),
	)
	.post(
		"/api/save",
		zValidator("json", sharedSchemaPayloadSchema, (result, c) => {
			if (!result.success) {
				return c.json(
					validationError("Request body must match the shared schema payload."),
					400,
				);
			}
		}),
		async (c) => {
			const payload = c.req.valid("json");
			const id = nanoid(8);

			try {
				await c.env.SCHEMAS.put(id, JSON.stringify(payload), {
					expirationTtl: SHARE_TTL_SECONDS,
				});
				return c.json({ id }, 201);
			} catch (error) {
				c.get("log").error(error instanceof Error ? error : new Error(String(error)));
				return c.json(
					{ error: "Unable to access the shared schema store." } satisfies ShareErrorResponse,
					500,
				);
			}
		},
	)
	.get(
		"/api/load/:id",
		zValidator("param", loadParamsSchema, (result, c) => {
			if (!result.success) {
				return c.json(validationError("A shared schema id is required."), 400);
			}
		}),
		async (c) => {
			const { id } = c.req.valid("param");

			try {
				const rawPayload = await c.env.SCHEMAS.get(id, "json");

				if (rawPayload === null) {
					return c.json(
						{ error: `Shared schema "${id}" was not found.` } satisfies ShareErrorResponse,
						404,
					);
				}

				const result = sharedSchemaPayloadSchema.safeParse(rawPayload);
				if (!result.success) {
					c.get("log").error(result.error);
					return c.json(
						{ error: "Unable to access the shared schema store." } satisfies ShareErrorResponse,
						500,
					);
				}

				return c.json(result.data, 200);
			} catch (error) {
				c.get("log").error(error instanceof Error ? error : new Error(String(error)));
				return c.json(
					{ error: "Unable to access the shared schema store." } satisfies ShareErrorResponse,
					500,
				);
			}
		},
	);

export type AppType = typeof app;
