import { z } from "zod";

export const SHARE_TTL_SECONDS = 60 * 60 * 24 * 90;
export const MAX_SCHEMA_SOURCE_LENGTH = 500_000;

export const stickyNoteColorSchema = z.enum(["yellow", "pink", "blue", "green"]);

export const sharePositionSchema = z.object({
	x: z.number(),
	y: z.number(),
});

export const sharedStickyNoteSchema = z.object({
	id: z.string(),
	x: z.number(),
	y: z.number(),
	width: z.number(),
	height: z.number(),
	color: stickyNoteColorSchema,
	text: z.string(),
});

export const sharedSchemaPayloadSchema = z.object({
	source: z
		.string()
		.max(MAX_SCHEMA_SOURCE_LENGTH)
		.refine((source) => source.trim().length > 0, "source must be a non-empty string"),
	positions: z.record(z.string(), sharePositionSchema),
	notes: z.array(sharedStickyNoteSchema),
	version: z.literal(3),
});

export type SharedSchemaPayload = z.infer<typeof sharedSchemaPayloadSchema>;

export interface SharedSchemaReference {
	readonly id: string;
}

export interface ShareErrorResponse {
	readonly error: string;
}
