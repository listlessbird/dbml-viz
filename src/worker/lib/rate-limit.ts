import { createMiddleware } from "hono/factory";
import type { Context, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";

const RATE_LIMIT_CONTEXT_KEY = ".rateLimited";
const STATUS_TOO_MANY_REQUESTS = 429;

/**
 * Rate limiting binding as defined by Cloudflare Workers.
 * @see https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/
 */
export interface RateLimitBinding {
	limit(options: { key: string }): Promise<{ success: boolean }>;
}

/**
 * Function that returns the key to rate limit on for a given request.
 * The key should represent a unique characteristic of a user or class of user.
 */
export type RateLimitKeyFunc = (c: Context) => string | Promise<string>;

export interface RateLimitOptions {
	readonly message?: string;
	readonly silentlyBypassEmptyKey?: boolean;
}

/**
 * Creates a rate limiting middleware for Hono applications.
 */
export const rateLimit = (
	rateLimitBinding: RateLimitBinding,
	keyFunc: RateLimitKeyFunc,
	options: RateLimitOptions = {},
): MiddlewareHandler => {
	return createMiddleware(async (c, next) => {
		const key = await keyFunc(c);
		if (!key) {
			if (!options.silentlyBypassEmptyKey) {
				console.warn(
					"the provided keyFunc returned an empty rate limiting key: bypassing rate limits",
				);
			}
			await next();
			return;
		}

		const { success } = await rateLimitBinding.limit({ key });
		c.set(RATE_LIMIT_CONTEXT_KEY as never, success as never);

		if (!success) {
			throw new HTTPException(STATUS_TOO_MANY_REQUESTS, {
				res: Response.json(
					{ error: options.message ?? "rate limited" },
					{ status: STATUS_TOO_MANY_REQUESTS },
				),
			});
		}

		await next();
	});
};

/**
 * Check if the current request passed rate limiting.
 */
export const rateLimitPassed = (c: Context): boolean | undefined => {
	return c.get(RATE_LIMIT_CONTEXT_KEY as never) as boolean | undefined;
};
