import { z } from "zod";

const MAX_SCHEMA_SOURCE_LENGTH = 500_000;

const stickyNoteColorSchema = z.enum(["yellow", "pink", "blue", "green"]);

const sharePositionSchema = z.object({
	x: z.number(),
	y: z.number(),
});

const sharedStickyNoteSchema = z.object({
	id: z.string(),
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

export type SharedSchemaPayload = z.infer<typeof sharedSchemaPayloadSchema>

export interface ShareErrorResponse {
	readonly error: string;
}


export type OGStatus = 
	| {
			status: "pending";
			createdAt: string;
			updatedAt: string;
			attempts: number;
	  }
	| {
			status: "ready";
			imageKey: string;
			imageUrl: string;
			createdAt: string;
			updatedAt: string;
			attempts: number;
	  }
	| {
			status: "failed";
			createdAt: string;
			updatedAt: string;
			attempts: number;
			error: string;
			nextRetryAt?: string;
	  };

export type OGQueueMessage = {id: string}