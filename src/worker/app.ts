import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { nanoid } from "nanoid";
import { z } from "zod";
import { initWorkersLogger } from "evlog/workers";
import { evlog, type EvlogVariables } from "evlog/hono";

import {
	sharedSchemaPayloadSchema,
	type ShareErrorResponse,
} from "./domain/schema-share";

import { enqueOgIfPossible } from "./lib/enque";

import {
	shareSaveDeviceRateLimit,
	shareSaveRateLimit,
} from "./lib/share-rate-limit";

initWorkersLogger({ env: { service: "dbml-viz" } });

const loadParamsSchema = z.object({
	id: z.string().min(1, "A shared schema id is required."),
});

const validationError = (message: string) =>
	({ error: message }) satisfies ShareErrorResponse;

export const app = new Hono<{ Bindings: Env } & EvlogVariables>()
	.use(evlog())
	.get("/api/health", (c) => c.json({ ok: true as const }, 200))
	// TODO: add some kind of rate limit here too
	// not sure whats a valid window atm
	// also check some kind of header to see if its coming from a valid client
	// not that i believe it will stop someone intent on causing trouble
	.all("/api/parse", (c) => c.env.SCHEMA_PARSER.fetch(c.req.raw))
	.post(
		"/api/save",
		shareSaveRateLimit(),
		shareSaveDeviceRateLimit(),
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
				await c.env.SCHEMAS.put(id, JSON.stringify(payload));

				c.executionCtx.waitUntil(
					enqueOgIfPossible(c.env, id)
						.catch((err) => {
							c.get("log").error(err instanceof Error ? err : new Error(String(err)));
						}),
				);

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
	)
	.get("/og/:id", async (c) => {

		const id = c.req.param("id")

		const cacheKey = new Request(
			c.req.url,
			{
				method: "GET",
				headers: c.req.raw.headers
			}
		)

		const cache = (caches as unknown as { default: Cache }).default;

		const cached = await cache.match(cacheKey)

		if (cached) return cached;

		const objectKey = `og-${id}.png`

		const object = await c.env.OG_IMAGES.get(objectKey)


		let response: Response;


		if (object === null) {
			// fallback to default og img

			response = await c.env.ASSETS.fetch(
				new URL("/og-image.png", c.req.url).toString(),
			)

			response = new Response(response.body, {
				status: 200,
				headers: {
					"content-type": "image/png",
					// if job finishes and a share img is genreated later
					"cache-control": "public, max-age=60"
				}
			})


		} else {
			const headers = new Headers()

			object.writeHttpMetadata(headers)

			headers.set("etag", object.httpEtag)
			headers.set("content-type", headers.get("content-type") ?? "image/png")

			headers.set("cache-control",
				"public, max-age=31536000, immutable"
			)

			response = new Response(object.body, {
				headers,
				status: 200
			})
		}

		c.executionCtx.waitUntil(
			cache.put(
				cacheKey,
				response.clone()
			)
		)

		return response
	})
	.get("/s/:id", async (c) => {
		const id = c.req.param("id");
		const origin = new URL(c.req.url).origin;
		const title = `Shared Schema - ${id}`;
		const url = `${origin}/s/${id}`;
		const ogImage = `${origin}/og/${id}.png`;

		const assetResponse = await c.env.ASSETS.fetch(
			`${origin}/`,
		);

		return new HTMLRewriter()
			.on("title", {
				element(el) {
					el.setInnerContent(title);
				},
			})
			.on('meta[property="og:title"]', {
				element(el) {
					el.setAttribute("content", title);
				},
			})
			.on('meta[property="og:url"]', {
				element(el) {
					el.setAttribute("content", url);
				},
			})
			.on('meta[property="og:image"]', {
				element(el) {
					el.setAttribute("content", ogImage);
				},
			})
			.on('meta[name="twitter:title"]', {
				element(el) {
					el.setAttribute("content", title);
				},
			})
			.on('meta[name="twitter:image"]', {
				element(el) {
					el.setAttribute("content", ogImage);
				},
			})
			.on('link[rel="canonical"]', {
				element(el) {
					el.setAttribute("href", url);
				},
			})
			.transform(assetResponse);
	})

export type AppType = typeof app;
