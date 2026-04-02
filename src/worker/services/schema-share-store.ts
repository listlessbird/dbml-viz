import { nanoid } from "nanoid";
import { Context, Effect, Layer, Schema } from "effect";

import {
	InvalidSchemaPayloadError,
	SchemaShareNotFoundError,
	SchemaShareStorageError,
	SHARE_TTL_SECONDS,
	SharedSchemaPayload,
	validateSharedSchemaPayload,
} from "../domain/schema-share";

export class SchemaShareStore extends Context.Tag("@app/SchemaShareStore")<
	SchemaShareStore,
	{
		readonly load: (
			id: string,
		) => Effect.Effect<SharedSchemaPayload, SchemaShareNotFoundError | SchemaShareStorageError>;
		readonly save: (
			payload: SharedSchemaPayload,
		) => Effect.Effect<{ readonly id: string }, InvalidSchemaPayloadError | SchemaShareStorageError>;
	}
>() {
	static layer = (env: Env) =>
		Layer.succeed(
			SchemaShareStore,
			{
				save: Effect.fn("SchemaShareStore.save")(function* (
					payload: SharedSchemaPayload,
				) {
					const validPayload = yield* validateSharedSchemaPayload(payload);
					const id = nanoid(8);

					yield* Effect.tryPromise({
						try: () =>
							env.SCHEMAS.put(id, JSON.stringify(validPayload), {
								expirationTtl: SHARE_TTL_SECONDS,
							}),
						catch: (error) =>
							new SchemaShareStorageError({
								operation: "put",
								id,
								error,
							}),
					});

					return { id };
				}),
				load: Effect.fn("SchemaShareStore.load")(function* (id: string) {
					const rawPayload = yield* Effect.tryPromise({
						try: () => env.SCHEMAS.get(id, "json"),
						catch: (error) =>
							new SchemaShareStorageError({
								operation: "get",
								id,
								error,
							}),
					});

					if (rawPayload === null) {
						return yield* new SchemaShareNotFoundError({ id });
					}

					return yield* Schema.decodeUnknown(SharedSchemaPayload)(rawPayload).pipe(
						Effect.mapError(
							(error) =>
								new SchemaShareStorageError({
									operation: "decode",
									id,
									error,
								}),
						),
					);
				}),
			},
		);
}
