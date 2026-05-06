import { Parser, type Database as DbmlDatabase } from "@dbml/core";

import {
	EMPTY_SCHEMA,
	type ParsedSchemaSourceRanges,
	type SourceRange,
} from "@/lib/parser-shared";
import type { ParsedSchema, RefData, RefType, TableData } from "@/types";

import {
	buildTableColumns,
	buildTableIndexes,
	collectForeignKeyColumns,
} from "./dbml-schema-indexes";

type ExportedDatabase = ReturnType<DbmlDatabase["export"]>;
type ExportedSchema = ExportedDatabase["schemas"][number];

const tableIdFromParts = (schemaName: string | null | undefined, tableName: string) =>
	schemaName && schemaName !== "public" ? `${schemaName}.${tableName}` : tableName;

const isNonEmptyString = (value: unknown): value is string =>
	typeof value === "string" && value.length > 0;

const normalizeRefAction = (value: unknown) =>
	isNonEmptyString(value) ? value.toLowerCase() : undefined;

const relationPairToType = (from: string, to: string): RefType => {
	if (from === "1" && to === "1") {
		return "one_to_one";
	}
	if (from === "1" && to === "*") {
		return "one_to_many";
	}
	if (from === "*" && to === "*") {
		return "many_to_many";
	}
	return "many_to_one";
};

const buildRefs = (schemas: readonly ExportedSchema[]): RefData[] => {
	const refs: RefData[] = [];

	for (const schema of schemas) {
		for (const ref of schema.refs) {
			const [fromEndpoint, toEndpoint] = ref.endpoints;
			if (!fromEndpoint || !toEndpoint) {
				continue;
			}

			const fromColumns = fromEndpoint.fieldNames.filter(isNonEmptyString);
			const toColumns = toEndpoint.fieldNames.filter(isNonEmptyString);
			if (fromColumns.length === 0 || toColumns.length === 0) {
				continue;
			}

			const fromTableId = tableIdFromParts(
				fromEndpoint.schemaName ?? schema.name,
				fromEndpoint.tableName,
			);
			const toTableId = tableIdFromParts(
				toEndpoint.schemaName ?? schema.name,
				toEndpoint.tableName,
			);
			const onDelete = normalizeRefAction(ref.onDelete);
			const onUpdate = normalizeRefAction(ref.onUpdate);

			refs.push({
				id: `${ref.name ?? `${fromTableId}:${fromColumns.join(",")}->${toTableId}:${toColumns.join(",")}`}:${refs.length}`,
				from: {
					table: fromTableId,
					columns: fromColumns,
				},
				to: {
					table: toTableId,
					columns: toColumns,
				},
				type: relationPairToType(fromEndpoint.relation, toEndpoint.relation),
				...(isNonEmptyString(ref.name) ? { name: ref.name } : {}),
				...(onDelete !== undefined ? { onDelete } : {}),
				...(onUpdate !== undefined ? { onUpdate } : {}),
			});
		}
	}

	return refs;
};

const buildTables = (
	schemas: readonly ExportedSchema[],
	refs: readonly RefData[],
): TableData[] => {
	const foreignKeyColumns = collectForeignKeyColumns(refs);

	return schemas.flatMap((schema) =>
		schema.tables.map((table) => {
			const tableId = tableIdFromParts(schema.name, table.name);
			const indexes = buildTableIndexes(tableId, table);

			return {
				id: tableId,
				name: table.name,
				...(schema.name === "public" ? {} : { schema: schema.name }),
				...(table.note !== undefined && table.note !== null ? { note: table.note } : {}),
				columns: buildTableColumns({
					tableId,
					fields: table.fields,
					indexes,
					foreignKeyColumns,
				}),
				indexes,
			};
		}),
	);
};

interface DbmlParseOutput {
	readonly parsed: ParsedSchema;
	readonly sourceRanges: ParsedSchemaSourceRanges;
}

const tokenToSourceRange = (token: {
	start: { line: number; column: number; offset: number };
	end: { line: number; column: number; offset: number };
}): SourceRange => ({
	start: { line: token.start.line, column: token.start.column, offset: token.start.offset },
	end: { line: token.end.line, column: token.end.column, offset: token.end.offset },
});

const collectSourceRanges = (
	database: DbmlDatabase,
	parsed: ParsedSchema,
): ParsedSchemaSourceRanges => {
	const tablesById: Record<string, SourceRange> = {};
	const refsById: Record<string, SourceRange> = {};

	for (const schema of database.schemas) {
		for (const table of schema.tables) {
			const tableId = tableIdFromParts(schema.name, table.name);
			if (table.token) {
				tablesById[tableId] = tokenToSourceRange(table.token);
			}
		}
	}

	let refIndex = 0;
	for (const schema of database.schemas) {
		for (const ref of schema.refs) {
			const refData = parsed.refs[refIndex];
			refIndex += 1;
			if (refData && ref.token) {
				refsById[refData.id] = tokenToSourceRange(ref.token);
			}
		}
	}

	return { tablesById, refsById };
};

export const buildParsedSchemaFromDatabase = (
	database: DbmlDatabase,
): DbmlParseOutput => {
	const exported = database.export();
	const refs = buildRefs(exported.schemas);
	const parsed: ParsedSchema = {
		tables: buildTables(exported.schemas, refs),
		refs,
		errors: [],
	};

	return {
		parsed,
		sourceRanges: collectSourceRanges(database, parsed),
	};
};

export const parseDbmlSource = (dbml: string): DbmlParseOutput => {
	if (dbml.trim().length === 0) {
		return { parsed: EMPTY_SCHEMA, sourceRanges: { tablesById: {}, refsById: {} } };
	}

	return buildParsedSchemaFromDatabase(Parser.parse(dbml, "dbmlv2"));
};
