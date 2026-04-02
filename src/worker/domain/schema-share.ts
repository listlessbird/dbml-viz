import { Data, Effect, Schema } from "effect";

export const SHARE_TTL_SECONDS = 60 * 60 * 24 * 90;
export const MAX_DBML_LENGTH = 500_000;

export class SharePosition extends Schema.Class<SharePosition>("SharePosition")({
	x: Schema.Number,
	y: Schema.Number,
}) {}

export class SharedSchemaPayload extends Schema.Class<SharedSchemaPayload>("SharedSchemaPayload")({
	dbml: Schema.String.pipe(Schema.maxLength(MAX_DBML_LENGTH)),
	positions: Schema.Record({ key: Schema.String, value: SharePosition }),
	version: Schema.Literal(1),
}) {}

export interface SharedSchemaReference {
	readonly id: string;
}

export class InvalidSchemaPayloadError extends Data.TaggedError("InvalidSchemaPayloadError")<{
	readonly reason: string;
}> {}

export class SchemaShareNotFoundError extends Data.TaggedError("SchemaShareNotFoundError")<{
	readonly id: string;
}> {}

export class SchemaShareStorageError extends Data.TaggedError("SchemaShareStorageError")<{
	readonly operation: string;
	readonly id: string | null;
	readonly error: unknown;
}> {}

export const validateSharedSchemaPayload = (payload: SharedSchemaPayload) =>
	payload.dbml.trim().length === 0
		? Effect.fail(
				new InvalidSchemaPayloadError({
				reason: "dbml must be a non-empty string",
				}),
			)
		: Effect.succeed(payload);
