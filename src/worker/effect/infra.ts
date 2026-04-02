import { HttpServer } from "@effect/platform";
import { Layer } from "effect";

import type { WorkerRuntimeInput } from "./runtime";
import { makeWorkerRuntimeContextLayer } from "./runtime";
import { RequestSummaryLive } from "../services/request-summary";

export const makeWorkerInfraLayer = (input: WorkerRuntimeInput) => {
	// Keep the runtime context in a constant so downstream layers reuse the same reference.
	const runtimeContextLayer = makeWorkerRuntimeContextLayer(input);

	return Layer.mergeAll(
		HttpServer.layerContext,
		runtimeContextLayer,
		RequestSummaryLive.pipe(Layer.provide(runtimeContextLayer)),
	);
};
