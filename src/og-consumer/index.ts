

import type { OGStatus, OGQueueMessage } from "../worker/domain/schema-share"



const OG_WIDTH = 1200
const OG_HEIGHT = 630

const statusKey = (id: string) => `og:${id}`
const imageKeyFor = (id: string) => `og-${id}.png`


async function takeScreenshot(env: Env, id: string): Promise<ArrayBuffer> {

    const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/browser-rendering/screenshot`,
        {
            method: "POST",
            headers: {
                authorization: `Bearer ${env.BROWSER_RENDERING_TOKEN}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                url: `${env.PUBLIC_APP_ORIGIN}/s/${id}`,
                viewport: { width: OG_WIDTH, height: OG_HEIGHT, deviceScaleFactor: 2 },
                gotoOptions: {
                    waitUntil: "networkidle0", timeout: 45000
                },
                screenshotOptions: { type: "png", fullPage: false },
                waitForSelector: { selector: ".react-flow__node-table" },
            })
        }
    )

    if (!res.ok) {
        throw new Error(`Browser renderign failed: ${res.status} ${await res.text()}`)
    }

    return res.arrayBuffer()

}


async function processMessage(env: Env, id: string, attempts: number) {
    const imageKey = imageKeyFor(id)
    const imageUrl = `${env.PUBLIC_APP_ORIGIN}/og/${id}.png`


    const existing = await env.OG_STATUS.get<OGStatus>(statusKey(id), "json")
    const createdAt = existing?.createdAt ?? new Date().toISOString()

    if (await env.OG_IMAGES.head(imageKey)) {
        await env.OG_STATUS.put(
            statusKey(id),
            JSON.stringify({
                status: "ready",
                imageKey,
                imageUrl,
                createdAt,
                updatedAt: new Date().toISOString(),
                attempts,
            } satisfies OGStatus)
        )

        return
    }

    const png = await takeScreenshot(env, id)

    await env.OG_IMAGES.put(imageKey, png, {
        httpMetadata: {
            contentType: "image/png",
            cacheControl: "public, max-age=31536000, immutable"
        },
        customMetadata: {
            "og-generated": "true",
            "schema-id": id
        }
    })

    await env.OG_STATUS.put(
        statusKey(id),
        JSON.stringify({
            status: "ready",
            imageKey,
            imageUrl,
            createdAt,
            updatedAt: new Date().toISOString(),
            attempts,
        } satisfies OGStatus),
    );

}


export default {
    async queue(batch, env, ctx): Promise<void> {
        for (const message of batch.messages) {

            const body = message.body as Partial<OGQueueMessage>

            const id = body.id

            if (!id) {
                console.error("Invalid queue message, dropping", { messageId: message.id })
                message.ack()
                continue
            }

            try {
                await processMessage(env, id, message.attempts)
                message.ack()
            } catch (error) {

                const errorMessage = error instanceof Error ? error.message : String(error)

                console.error("OG gerneation failed", {
                    messageId: message.id,
                    attempts: message.attempts,
                    ts: message.timestamp,
                    error: errorMessage,
                })

                const existing = await env.OG_STATUS.get<OGStatus>(statusKey(id), "json");
                const now = new Date().toISOString();

                await env.OG_STATUS.put(
                    statusKey(id),
                    JSON.stringify({
                        status: "failed",
                        createdAt: existing?.createdAt ?? now,
                        updatedAt: now,
                        attempts: message.attempts,
                        error: errorMessage,
                    } satisfies OGStatus),
                );

                message.retry({ delaySeconds: 30 });

            }

        }
    },
} satisfies ExportedHandler<Env>;