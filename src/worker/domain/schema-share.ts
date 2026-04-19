import { Data, Effect, Schema } from "effect";

export const SHARE_TTL_SECONDS = 60 * 60 * 24 * 90;
export const MAX_SCHEMA_SOURCE_LENGTH = 500_000;

export class SharePosition extends Schema.Class<SharePosition>("SharePosition")({
	x: Schema.Number,
	y: Schema.Number,
}) {}

export const StickyNoteColorSchema = Schema.Literal("yellow", "pink", "blue", "green");

export class SharedStickyNote extends Schema.Class<SharedStickyNote>("SharedStickyNote")({
	id: Schema.String,
	x: Schema.Number,
	y: Schema.Number,
	width: Schema.Number,
	height: Schema.Number,
	color: StickyNoteColorSchema,
	text: Schema.String,
}) {}

export class SharedSchemaPayload extends Schema.Class<SharedSchemaPayload>("SharedSchemaPayload")({
	source: Schema.String.pipe(Schema.maxLength(MAX_SCHEMA_SOURCE_LENGTH)),
	positions: Schema.Record({ key: Schema.String, value: SharePosition }),
	notes: Schema.Array(SharedStickyNote),
	version: Schema.Literal(3),
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
	payload.source.trim().length === 0
		? Effect.fail(
				new InvalidSchemaPayloadError({
					reason: "source must be a non-empty string",
				}),
			)
		: Effect.succeed(payload);
