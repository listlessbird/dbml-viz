import type { OGQueueMessage, OGStatus } from "../domain/schema-share";


export async function enqueOgIfPossible(env: Env, id: string) {
    const now = new Date().toISOString();

    const budget = await env.OG_BUDGET.getByName("global")

    const decision = await budget.reserve(Date.now())

    if (!decision.ok) {
        await env.OG_STATUS.put(
            `og:${id}`,
            JSON.stringify({
                status: "skipped",
                reason: decision.reason,
                createdAt: now,
                updatedAt: now,
                attempts: 0
            } satisfies OGStatus)
        )
        return
    }

    await Promise.all([
        env.OG_STATUS.put(
            `og:${id}`,
            JSON.stringify({
                status: "pending",
                createdAt: now,
                updatedAt: now,
                attempts: 0,
            } satisfies OGStatus),
        ),
        env.OG_QUEUE.send({ id } satisfies OGQueueMessage),
    ]);
}