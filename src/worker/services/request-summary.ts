import { Clock, Context, Effect, Layer } from "effect";

import { WorkerRuntimeContext } from "../effect/runtime";

export interface RequestSummaryPayload {
	readonly message: string;
	readonly method: string;
	readonly path: string;
	readonly bindingKeys: ReadonlyArray<string>;
	readonly receivedAt: string;
}

export class RequestSummary extends Context.Tag("@app/RequestSummary")<
	RequestSummary,
	{
		readonly describe: () => Effect.Effect<RequestSummaryPayload>;
	}
>() {}

export const RequestSummaryLive = Layer.effect(
	RequestSummary,
	Effect.gen(function* () {
		const runtimeContext = yield* WorkerRuntimeContext;

		const describe = Effect.fn("RequestSummary.describe")(function* () {
			const currentTimeMillis = yield* Clock.currentTimeMillis;
			const url = new URL(runtimeContext.request.url);

			return {
				message: "Effect runtime is running at the Worker boundary",
				method: runtimeContext.request.method,
				path: url.pathname,
				bindingKeys: Object.keys(runtimeContext.env).sort(),
				receivedAt: new Date(currentTimeMillis).toISOString(),
			} satisfies RequestSummaryPayload;
		});

		return RequestSummary.of({ describe });
	}),
);
