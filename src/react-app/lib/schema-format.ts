import type { RefEndpointData, TableIndexData, TableIndexKind } from "@/types";

const indexKindLabels: Record<TableIndexKind, string> = {
	primary: "PRIMARY KEY",
	unique: "UNIQUE",
	index: "INDEX",
};

const formatColumnList = (columns: readonly string[]) =>
	columns.length === 1 ? columns[0] : `(${columns.join(", ")})`;

const formatQualifiedColumns = (endpoint: RefEndpointData) =>
	`${endpoint.table}.${formatColumnList(endpoint.columns)}`;

export const formatRefEndpointSummary = (
	from: RefEndpointData,
	to: RefEndpointData,
) => `${formatQualifiedColumns(from)} references ${formatQualifiedColumns(to)}`;

const formatIndexKind = (kind: TableIndexKind) => indexKindLabels[kind];

export const formatIndexSummary = (index: TableIndexData) => {
	const parts = [formatIndexKind(index.kind), formatColumnList(index.columns)];

	if (index.method) {
		parts.push(`USING ${index.method}`);
	}

	return parts.join(" ");
};
