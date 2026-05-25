// limit og gen per day
// DO is a good primitive for this i believe
//  only one instance as a global counter



import { DurableObject } from "cloudflare:workers";
import type { OGLimitReason } from "src/worker/domain/schema-share";


type LimitReason = OGLimitReason
export type BudgetDecision =
    | { ok: true }
    | { ok: false; reason: LimitReason }

const MAX_ACCEPTED_PER_DAY = 100
const MAX_FAILURES_PER_HOUR = 10
const MAX_BROWSER_MS_PER_DAY = 15 * 60 * 1000
// included 10hr/mo in the plan
const MAX_BROWSER_MS_PER_MONTH = 8 * 60 * 60 * 1000


export class OGBudget extends DurableObject<Env> {
    constructor(ctx: DurableObjectState, env: Env) {
        super(ctx, env)

        ctx.storage.sql.exec(`
                CREATE TABLE IF NOT EXISTS  counters (
                key TEXT PRIMARY KEY,
                value  INTEGER NOT NULL
                )
        `)
    }

    reserve(now: number = Date.now()): BudgetDecision {

        return this.ctx.storage.transactionSync(() => {

            const { acceptedKey, failedKey, browserMsDayKey, browserMsMonthKey } = this.keysFor(now)

            if (this.getCounter(acceptedKey) >= MAX_ACCEPTED_PER_DAY) {
                return { ok: false, reason: "daily_cap" }
            }

            if (this.getCounter(failedKey) >= MAX_FAILURES_PER_HOUR) {
                return { ok: false, reason: "failure_cap" }
            }

            if (this.getCounter(browserMsDayKey) >= MAX_BROWSER_MS_PER_DAY) {
                return { ok: false, reason: "daily_browser_ms_cap" }
            }

            if (this.getCounter(browserMsMonthKey) >= MAX_BROWSER_MS_PER_MONTH) {
                return { ok: false, reason: "monthly_browser_ms_cap" }
            }

            this.incrCounter(acceptedKey, 1)

            return { ok: true }
        })

    }

    canRender(now: number = Date.now()): BudgetDecision {
        const { failedKey, browserMsDayKey, browserMsMonthKey } = this.keysFor(now);

        if (this.getCounter(failedKey) >= MAX_FAILURES_PER_HOUR) {
            return { ok: false, reason: "failure_cap" };
        }
        if (this.getCounter(browserMsDayKey) >= MAX_BROWSER_MS_PER_DAY) {
            return { ok: false, reason: "daily_browser_ms_cap" };
        }
        if (this.getCounter(browserMsMonthKey) >= MAX_BROWSER_MS_PER_MONTH) {
            return { ok: false, reason: "monthly_browser_ms_cap" };
        }

        return { ok: true };
    }

    recordSuccess(browserMs: number, now: number = Date.now()) {
        const ms = Math.max(0, Math.floor(browserMs))

        const { browserMsDayKey, browserMsMonthKey } = this.keysFor(now)

        this.ctx.storage.transactionSync(() => {
            this.incrCounter(browserMsDayKey, ms)
            this.incrCounter(browserMsMonthKey, ms)
        })
    }

    recordFailure(now: number = Date.now()): void {
        this.incrCounter(this.keysFor(now).failedKey, 1);
    }


    private keysFor(now: number) {
        const iso = new Date(now).toISOString()

        return {
            acceptedKey: `accepted:${iso.slice(0, 10)}`,
            failedKey: `failed:${iso.slice(0, 13)}`,
            browserMsDayKey: `browser_ms_day:${iso.slice(0, 10)}`,
            browserMsMonthKey: `browser_ms_month:${iso.slice(0, 7)}`,
        }
    }

    private getCounter(key: string): number {
        const row = this.ctx.storage.sql
            .exec<{ value: number }>("SELECT value from counters WHERE key = ?", key)
            .toArray()[0]

        return row?.value ?? 0
    }

    private incrCounter(key: string, by: number): void {
        this.ctx.storage.sql.exec(
            `INSERT INTO counters (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = value + excluded.value`,
            key,
            by
        )
    }
}

