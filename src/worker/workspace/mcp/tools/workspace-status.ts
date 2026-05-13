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

export const runWorkspaceStatusTool = async (
	context: WorkspaceMcpContext,
) => {
	const ready = await context.requireWorkspace();
	if (Result.isError(ready)) {
		return context.createAvailabilityErrorResult(ready.error);
	}

	const { workspace, status } = ready.value;
	const parsed = await context.parserClient.parseSchemaSource(workspace.source);

	if (Result.isOk(parsed)) {
		return toWorkspaceMcpResult(
			Result.ok({
				ok: true as const,
				status: {
					...status,
					tableCount: parsed.value.parsed.tables.length,
					refCount: parsed.value.parsed.refs.length,
					diagnosticCount: 0,
				},
			}),
		);
	}

	if (parsed.error._tag === "ParserSyntaxError") {
		return toWorkspaceMcpResult(
			Result.ok({
				ok: true as const,
				status: {
					...status,
					tableCount: 0,
					refCount: 0,
					diagnosticCount: parsed.error.diagnostics.length,
				},
			}),
		);
	}

	return context.createParserUnreachableResult(parsed.error, status);
};

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
	handler: (context: WorkspaceMcpContext) => () => runWorkspaceStatusTool(context),
} as const;
