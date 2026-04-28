import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { nanoid } from "nanoid";
import { z } from "zod";

import {
	SHARE_TTL_SECONDS,
	sharedSchemaPayloadSchema,
	type ShareErrorResponse,
} from "./domain/schema-share";
import { callWorkspace } from "./durable-objects/call-workspace";

const loadParamsSchema = z.object({
	id: z.string().min(1, "A shared schema id is required."),
});

const validationError = (message: string) =>
	({ error: message }) satisfies ShareErrorResponse;

export const app = new Hono<{ Bindings: Env }>()
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
				console.error("error saving shared schema", error);
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
					console.error("error decoding shared schema", result.error);
					return c.json(
						{ error: "Unable to access the shared schema store." } satisfies ShareErrorResponse,
						500,
					);
				}

				return c.json(result.data, 200);
			} catch (error) {
				console.error("error loading shared schema", error);
				return c.json(
					{ error: "Unable to access the shared schema store." } satisfies ShareErrorResponse,
					500,
				);
			}
		},
	);

export type AppType = typeof app;
