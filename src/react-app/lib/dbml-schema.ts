import { Parser, type Database as DbmlDatabase } from "@dbml/core";

import {
	buildTableColumns,
	buildTableIndexes,
	collectForeignKeyColumns,
} from "@/lib/dbml-schema-indexes";
import { EMPTY_SCHEMA } from "@/lib/parser-shared";
import type { ParsedSchema, RefData, RefType, TableData } from "@/types";

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
				name: isNonEmptyString(ref.name) ? ref.name : undefined,
				onDelete: normalizeRefAction(ref.onDelete),
				onUpdate: normalizeRefAction(ref.onUpdate),
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
				schema: schema.name === "public" ? undefined : schema.name,
				note: table.note ?? undefined,
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

export const buildParsedSchemaFromDatabase = (database: DbmlDatabase): ParsedSchema => {
	const exported = database.export();
	const refs = buildRefs(exported.schemas);

	return {
		tables: buildTables(exported.schemas, refs),
		refs,
		errors: [],
	};
};

export const parseDbmlSource = (dbml: string): ParsedSchema => {
	if (dbml.trim().length === 0) {
		return EMPTY_SCHEMA;
	}

	return buildParsedSchemaFromDatabase(Parser.parse(dbml, "dbmlv2"));
};
