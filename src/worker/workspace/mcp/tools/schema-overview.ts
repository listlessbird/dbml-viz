import { Result } from "better-result";
import { z } from "zod";

import type {
	ParserDiagnostic,
	ParserParsedSchema,
} from "../../../lib/parser-client.ts";
import type { WorkspaceMcpContext } from "../context.ts";
import { toWorkspaceMcpResult } from "../result.ts";

const schemaOverviewTableSchema = z.object({
	id: z.string(),
	name: z.string(),
	columns: z.array(z.string()),
});

const schemaOverviewRelationshipSchema = z.object({
	id: z.string(),
	from: z.object({
		table: z.string(),
		columns: z.array(z.string()),
	}),
	to: z.object({
		table: z.string(),
		columns: z.array(z.string()),
	}),
	type: z.string(),
	name: z.string().optional(),
});

interface WorkspaceSchemaOverview {
	readonly tables: readonly {
		readonly id: string;
		readonly name: string;
		readonly columns: readonly string[];
	}[];
	readonly relationships: readonly {
		readonly id: string;
		readonly from: {
			readonly table: string;
			readonly columns: readonly string[];
		};
		readonly to: {
			readonly table: string;
			readonly columns: readonly string[];
		};
		readonly type: string;
		readonly name?: string;
	}[];
}

interface SchemaOverviewPayload extends Record<string, unknown> {
	readonly ok: true;
	readonly freshness: {
		readonly updatedAt: number;
	};
	readonly counts: {
		readonly tables: number;
		readonly relationships: number;
		readonly diagnostics: number;
	};
	readonly tables: WorkspaceSchemaOverview["tables"];
	readonly relationships: WorkspaceSchemaOverview["relationships"];
	readonly diagnostics: readonly ParserDiagnostic[];
}

export const deriveSchemaOverview = (
	parsed: ParserParsedSchema,
): WorkspaceSchemaOverview => ({
	tables: parsed.tables.map((table) => ({
		id: table.id,
		name: table.name,
		columns: table.columns.map((column) => column.name),
	})),
	relationships: parsed.refs.map((ref) => ({
		id: ref.id,
		from: { table: ref.from.table, columns: [...ref.from.columns] },
		to: { table: ref.to.table, columns: [...ref.to.columns] },
		type: ref.type,
		...(ref.name !== undefined ? { name: ref.name } : {}),
	})),
});

export const createSchemaOverviewPayload = ({
	updatedAt,
	overview,
	diagnostics,
}: {
	readonly updatedAt: number;
	readonly overview: WorkspaceSchemaOverview;
	readonly diagnostics: readonly ParserDiagnostic[];
}): SchemaOverviewPayload => ({
	ok: true,
	freshness: { updatedAt },
	counts: {
		tables: overview.tables.length,
		relationships: overview.relationships.length,
		diagnostics: diagnostics.length,
	},
	tables: overview.tables,
	relationships: overview.relationships,
	diagnostics,
});

export const runSchemaOverviewTool = async (
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
			Result.ok(createSchemaOverviewPayload({
				updatedAt: workspace.updatedAt,
				overview: deriveSchemaOverview(parsed.value.parsed),
				diagnostics: [],
			})),
		);
	}

	if (parsed.error._tag === "ParserSyntaxError") {
		return toWorkspaceMcpResult(
			Result.ok(createSchemaOverviewPayload({
				updatedAt: workspace.updatedAt,
				overview: { tables: [], relationships: [] },
				diagnostics: parsed.error.diagnostics,
			})),
		);
	}

	return context.createParserUnreachableResult(parsed.error, status);
};

export const schemaOverviewTool = {
	name: "schema_overview",
	config: {
		description:
			"Returns compact Parsed Schema tables, columns, relationships, diagnostics, and Workspace freshness. Use after workspace_status to choose a targeted schema_source_slice. Does not return Schema Source.",
		outputSchema: {
			ok: z.literal(true),
			freshness: z.object({ updatedAt: z.number() }),
			counts: z.object({
				tables: z.number().int().nonnegative(),
				relationships: z.number().int().nonnegative(),
				diagnostics: z.number().int().nonnegative(),
			}),
			tables: z.array(schemaOverviewTableSchema),
			relationships: z.array(schemaOverviewRelationshipSchema),
			diagnostics: z.array(z.unknown()),
		},
		annotations: { readOnlyHint: true },
	},
	handler: (context: WorkspaceMcpContext) => () => runSchemaOverviewTool(context),
} as const;
