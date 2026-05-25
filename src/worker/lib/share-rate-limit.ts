import type { Context, MiddlewareHandler } from "hono";

import { rateLimit } from "./rate-limit";

const SAVE_RATE_LIMIT_MESSAGE = "Too many share attempts. Try again later.";
const SHARE_DEVICE_ID_HEADER = "x-dbml-viz-device-id";
const DEVICE_ID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/*
 * Share saves trigger dynamic OG generation, so they are rate limited before
 * any KV writes or queue sends happen.
 *
 * Configured in wrangler.json:
 * - SAVE_IP_RATE_LIMITER: 10 saves / 60s per Cloudflare location and client IP.
 * - SAVE_DEVICE_RATE_LIMITER: 3 saves / 60s per Cloudflare location and
 *   browser device id.
 *
 * When both keys exist, both gates must pass. The device id is client generated,
 * so it is a secondary limiter only; direct/API clients without a valid device
 * id still go through the primary IP limiter.
 */
const clientIp = (c: Context): string =>
	c.req.header("cf-connecting-ip") ??
	c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
	"unknown";

const deviceId = (c: Context): string | null => {
	const raw = c.req.header(SHARE_DEVICE_ID_HEADER)?.trim();
	if (!raw || !DEVICE_ID_PATTERN.test(raw)) return null;
	return raw.toLowerCase();
};

export const shareSaveRateLimit = (): MiddlewareHandler =>
	async (c, next) =>
		rateLimit(
			c.env.SAVE_IP_RATE_LIMITER,
			(requestContext) => `share-save:ip:${clientIp(requestContext)}`,
			{ message: SAVE_RATE_LIMIT_MESSAGE },
		)(c, next);

export const shareSaveDeviceRateLimit = (): MiddlewareHandler =>
	async (c, next) =>
		rateLimit(
			c.env.SAVE_DEVICE_RATE_LIMITER,
			(requestContext) => {
				const id = deviceId(requestContext);
				if (!id) return "";
				return `share-save:device:${id}`;
			},
			{
				message: SAVE_RATE_LIMIT_MESSAGE,
				silentlyBypassEmptyKey: true,
			},
		)(c, next);

export { SHARE_DEVICE_ID_HEADER };
