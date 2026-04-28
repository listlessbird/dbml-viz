import type { Database as DbmlDatabase } from "@dbml/core";

import type { ColumnData, RefData, TableIndexData, TableIndexKind } from "@/types";

type ExportedDatabase = ReturnType<DbmlDatabase["export"]>;
type ExportedTable = ExportedDatabase["schemas"][number]["tables"][number];
type ExportedField = ExportedTable["fields"][number];
type ExportedIndex = ExportedTable["indexes"][number];

const isNonEmptyString = (value: unknown): value is string =>
	typeof value === "string" && value.length > 0;

const formatType = (type: {
	schemaName?: string | null;
	type_name?: string | null;
	lengthParam?: number;
	numericParams?: { precision: number; scale?: number };
	args?: string | null;
}) => {
	const baseName = [type.schemaName, type.type_name].filter(Boolean).join(".");
	const argsSuffix =
		typeof type.args === "string" && type.args.length > 0 ? `(${type.args})` : "";
	const lengthSuffix =
		typeof type.lengthParam === "number" ? `(${type.lengthParam})` : "";
	const numericSuffix =
		type.numericParams && typeof type.numericParams.precision === "number"
			? `(${type.numericParams.precision}${
					typeof type.numericParams.scale === "number"
						? `, ${type.numericParams.scale}`
						: ""
				})`
			: "";

	return `${baseName || "unknown"}${argsSuffix || lengthSuffix || numericSuffix}`;
};

const extractIndexColumns = (index: ExportedIndex) =>
	index.columns.map((column) => column.value).filter(isNonEmptyString);

const getIndexKind = (index: ExportedIndex): TableIndexKind =>
	index.pk ? "primary" : index.unique ? "unique" : "index";

const createIndexKey = (kind: TableIndexKind, columns: readonly string[]) =>
	`${kind}:${columns.join("\u0000")}`;

const createIndexId = (
	tableId: string,
	kind: TableIndexKind,
	columns: readonly string[],
	name: string | undefined,
	index: number,
) => `${tableId}:index:${name ?? `${kind}:${columns.join(",")}`}:${index}`;

export const buildTableIndexes = (tableId: string, table: ExportedTable): TableIndexData[] => {
	const indexes: TableIndexData[] = [];
	const seenKeys = new Set<string>();

	const pushIndex = ({
		kind,
		columns,
		name,
		method,
		note,
		index,
	}: {
		kind: TableIndexKind;
		columns: readonly string[];
		name?: string;
		method?: string;
		note?: string;
		index: number;
	}) => {
		if (columns.length === 0) {
			return;
		}

		const key = createIndexKey(kind, columns);
		if (seenKeys.has(key)) {
			return;
		}

		seenKeys.add(key);
		indexes.push({
			id: createIndexId(tableId, kind, columns, name, index),
			kind,
			columns,
			...(name !== undefined ? { name } : {}),
			...(method !== undefined ? { method } : {}),
			...(note !== undefined ? { note } : {}),
		});
	};

	table.indexes.forEach((index, indexPosition) => {
		const name = isNonEmptyString(index.name) ? index.name : undefined;
		const method = isNonEmptyString(index.type) ? index.type : undefined;
		const note = isNonEmptyString(index.note) ? index.note : undefined;

		pushIndex({
			kind: getIndexKind(index),
			columns: extractIndexColumns(index),
			...(name !== undefined ? { name } : {}),
			...(method !== undefined ? { method } : {}),
			...(note !== undefined ? { note } : {}),
			index: indexPosition,
		});
	});

	const inlinePrimaryColumns = table.fields
		.filter((field) => field.pk)
		.map((field) => field.name);

	if (inlinePrimaryColumns.length > 0) {
		pushIndex({
			kind: "primary",
			columns: inlinePrimaryColumns,
			index: indexes.length,
		});
	}

	table.fields.forEach((field, indexPosition) => {
		if (!field.unique) {
			return;
		}

		pushIndex({
			kind: "unique",
			columns: [field.name],
			index: table.indexes.length + indexPosition + 1,
		});
	});

	return indexes;
};

export const collectForeignKeyColumns = (refs: readonly RefData[]) => {
	const columnsByTable = new Map<string, Set<string>>();

	for (const ref of refs) {
		const sourceColumns = columnsByTable.get(ref.from.table) ?? new Set<string>();
		ref.from.columns.forEach((column) => sourceColumns.add(column));
		columnsByTable.set(ref.from.table, sourceColumns);
	}

	return columnsByTable;
};

export const buildTableColumns = ({
	tableId,
	fields,
	indexes,
	foreignKeyColumns,
}: {
	tableId: string;
	fields: readonly ExportedField[];
	indexes: readonly TableIndexData[];
	foreignKeyColumns: ReadonlyMap<string, Set<string>>;
}): ColumnData[] => {
	const primaryColumns = new Set(
		indexes
			.filter((index) => index.kind === "primary")
			.flatMap((index) => index.columns),
	);
	const uniqueColumns = new Set(
		indexes
			.filter((index) => index.kind === "unique" && index.columns.length === 1)
			.map((index) => index.columns[0]),
	);
	const indexedColumns = new Set(indexes.flatMap((index) => index.columns));
	const tableForeignKeys = foreignKeyColumns.get(tableId);

	return fields.map((field) => ({
		name: field.name,
		type: formatType(field.type),
		pk: primaryColumns.has(field.name),
		notNull: Boolean(field.not_null),
		unique: uniqueColumns.has(field.name),
		isForeignKey: tableForeignKeys?.has(field.name) ?? false,
		isIndexed: indexedColumns.has(field.name),
		...(field.note !== undefined && field.note !== null ? { note: field.note } : {}),
	}));
};
