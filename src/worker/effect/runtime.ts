import { HttpApp } from "@effect/platform";
import { Context, Layer, ManagedRuntime } from "effect";
import type * as Scope from "effect/Scope";

export interface WorkerRuntimeInput {
	readonly env: Env;
	readonly request: Request;
	readonly executionCtx: ExecutionContext;
}

export class WorkerRuntimeContext extends Context.Tag("@app/WorkerRuntimeContext")<
	WorkerRuntimeContext,
	{
		readonly env: Env;
		readonly request: Request;
		readonly waitUntil: (promise: Promise<unknown>) => void;
	}
>() {}

export const makeWorkerRuntimeContextLayer = ({ env, request, executionCtx }: WorkerRuntimeInput) =>
	Layer.succeed(
		WorkerRuntimeContext,
		WorkerRuntimeContext.of({
			env,
			request,
			waitUntil: (promise) => executionCtx.waitUntil(promise),
		}),
	);

export const makeWorkerHandler = <E, R, RE>(
	app: HttpApp.Default<E, R | Scope.Scope>,
	makeLayer: (input: WorkerRuntimeInput) => Layer.Layer<R, RE, never>,
) => {
	return async (request: Request, env: Env, executionCtx: ExecutionContext) => {
		const runtime = ManagedRuntime.make(makeLayer({ env, request, executionCtx }));
		const handler = HttpApp.toWebHandlerRuntime(await runtime.runtime())(app);

		try {
			return await handler(request);
		} finally {
			await runtime.dispose();
		}
	};
};
