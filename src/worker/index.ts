import { HttpRouter, HttpServerRequest, HttpServerResponse } from "@effect/platform";
import { Effect } from "effect";

import {
	InvalidSchemaPayloadError,
	SchemaShareNotFoundError,
	SchemaShareStorageError,
	SharedSchemaPayload,
} from "./domain/schema-share";
import { makeWorkerInfraLayer } from "./effect/infra";
import { makeWorkerHandler } from "./effect/runtime";
import { SchemaShareStore } from "./services/schema-share-store";

import { callWorkspace } from "./durable-objects/call-workspace";

const withJsonErrorBoundary = <R>(
	program: Effect.Effect<
		HttpServerResponse.HttpServerResponse,
		InvalidSchemaPayloadError | SchemaShareNotFoundError | SchemaShareStorageError,
		R
	>,
) =>
	program.pipe(
		Effect.catchTags({
			InvalidSchemaPayloadError: (error: InvalidSchemaPayloadError) =>
				Effect.succeed(
					HttpServerResponse.unsafeJson(
						{ error: error.reason },
						{
							status: 400,
						},
					),
				),
			SchemaShareNotFoundError: (error: SchemaShareNotFoundError) =>
				Effect.succeed(
					HttpServerResponse.unsafeJson(
						{ error: `Shared schema "${error.id}" was not found.` },
						{
							status: 404,
						},
					),
				),
				SchemaShareStorageError: () =>
				Effect.succeed(
					HttpServerResponse.unsafeJson(
						{ error: "Unable to access the shared schema store." },
						{
							status: 500,
						},
					),
				),
		}),
	);

const app = HttpRouter.empty.pipe(
	HttpRouter.get("/api/health", HttpServerResponse.unsafeJson({ ok: true })),
	HttpRouter.post(
		"/api/save",
		withJsonErrorBoundary(
			Effect.gen(function* () {
				const payload = yield* HttpServerRequest.schemaBodyJson(SharedSchemaPayload).pipe(
					Effect.mapError(
						() =>
							new InvalidSchemaPayloadError({
								reason: "Request body must match the shared schema payload.",
							}),
					),
				);
				const store = yield* SchemaShareStore;
				const reference = yield* store.save(payload);

				return HttpServerResponse.unsafeJson(reference, { status: 201 });
			}),
		),
	),
	HttpRouter.get(
		"/api/load/:id",
		withJsonErrorBoundary(
			Effect.gen(function* () {
				const { id } = yield* HttpRouter.params;
				if (!id) {
					return yield* new InvalidSchemaPayloadError({
						reason: "A shared schema id is required.",
					});
				}

				const store = yield* SchemaShareStore;
				const payload = yield* store.load(id);
				return HttpServerResponse.unsafeJson(payload);
			}),
		),
	),
);

const effectHandler = makeWorkerHandler(app, makeWorkerInfraLayer);


const SESSION_PATH_PATTERN = /^\/api\/agent\/([A-Za-z0-9_-]+)\/(ws|mcp.*)$/;

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const match = SESSION_PATH_PATTERN.exec(url.pathname);

		if (match) {
			const [, workspaceId] = match;
			return callWorkspace(env, workspaceId, (stub) => stub.fetch(request));
		}

		return effectHandler(request, env, ctx);
	},
};


export {
	SchemaWorkspaceDO,
	SchemaWorkspaceDO as SchemaSessionDO,
} from "./durable-objects/schema-workspace";
