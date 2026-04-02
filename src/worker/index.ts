import { HttpRouter, HttpServerResponse } from "@effect/platform";
import { Effect } from "effect";

import { makeWorkerInfraLayer } from "./effect/infra";
import { makeWorkerHandler } from "./effect/runtime";
import { RequestSummary } from "./services/request-summary";

const app = HttpRouter.empty.pipe(
	HttpRouter.get("/api/", HttpServerResponse.unsafeJson({ name: "Cloudflare" })),
	HttpRouter.get(
		"/api/effect",
		Effect.gen(function* () {
			const requestSummary = yield* RequestSummary;
			return HttpServerResponse.unsafeJson(yield* requestSummary.describe());
		}),
	),
);

export default {
	fetch: makeWorkerHandler(app, makeWorkerInfraLayer),
};
