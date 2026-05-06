import { Result } from "better-result";
import { z } from "zod";

import { toWorkspaceMcpResult } from "../result.ts";
import type { WorkspaceMcpContext } from "../context.ts";

export const workspaceMcpStatusSchema = z.object({
	workspaceActive: z.boolean(),
	canvasPresence: z.object({
		connected: z.boolean(),
		connectionCount: z.number().int().nonnegative(),
	}),
	updatedAt: z.number().nullable(),
	tableCount: z.number().int().nonnegative(),
	refCount: z.number().int().nonnegative(),
	diagnosticCount: z.number().int().nonnegative(),
});

export const workspaceStatusTool = {
	name: "workspace_status",
	config: {
		description:
			"Inspect durable Workspace state and Canvas Presence. Use this before Schema Co-editing tools. Read-only and safe when no browser Canvas is connected.",
		outputSchema: {
			ok: z.literal(true),
			status: workspaceMcpStatusSchema,
		},
		annotations: { readOnlyHint: true },
	},
	handler:
		(context: WorkspaceMcpContext) =>
		async () => {
			const status = await context.getStatus();
			return toWorkspaceMcpResult(Result.ok({ ok: true, status }));
		},
} as const;
