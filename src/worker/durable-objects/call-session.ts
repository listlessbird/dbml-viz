import type { SchemaSessionDO } from "./schema-session.ts";

export async function callSession<T>(
	env: Env,
	sessionId: string,
	fn: (stub: DurableObjectStub<SchemaSessionDO>) => Promise<T>,
	maxAttempts = 3,
): Promise<T> {
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const stub = env.SESSIONS.get(env.SESSIONS.idFromName(sessionId));
		try {
			return await fn(stub);
		} catch (error) {
			const err = error as Error & { retryable?: boolean; overloaded?: boolean };
			const shouldRetry = err.retryable === true && err.overloaded !== true;

			if (!shouldRetry || attempt === maxAttempts - 1) {
				throw error;
			}

			const backoffMs = Math.min(20_000, 100 * Math.random() * 2 ** attempt);
			await scheduler.wait(backoffMs);
		}
	}

	throw new Error("unreachable");
}
