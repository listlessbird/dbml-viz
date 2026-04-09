import type { RefData, RefEndpointData, TableIndexData, TableIndexKind } from "@/types";

const indexKindLabels: Record<TableIndexKind, string> = {
	primary: "PRIMARY KEY",
	unique: "UNIQUE",
	index: "INDEX",
};

export const formatColumnList = (columns: readonly string[]) =>
	columns.length === 1 ? columns[0] : `(${columns.join(", ")})`;

export const formatQualifiedColumns = (endpoint: RefEndpointData) =>
	`${endpoint.table}.${formatColumnList(endpoint.columns)}`;

export const formatRefEndpointSummary = (
	from: RefEndpointData,
	to: RefEndpointData,
) => `${formatQualifiedColumns(from)} references ${formatQualifiedColumns(to)}`;

export const formatIndexKind = (kind: TableIndexKind) => indexKindLabels[kind];

export const formatIndexSummary = (index: TableIndexData) => {
	const parts = [formatIndexKind(index.kind), formatColumnList(index.columns)];

	if (index.method) {
		parts.push(`USING ${index.method}`);
	}

	return parts.join(" ");
};

export const getRefConstraintSummary = (ref: RefData) =>
	formatRefEndpointSummary(ref.from, ref.to);

export const getRefTooltipLines = (ref: RefData) => {
	const lines = [`${ref.from.table} -> ${ref.to.table}`, getRefConstraintSummary(ref), ref.type];

	if (ref.name) {
		lines.push(`constraint ${ref.name}`);
	}

	if (ref.onDelete) {
		lines.push(`on delete ${ref.onDelete}`);
	}

	if (ref.onUpdate) {
		lines.push(`on update ${ref.onUpdate}`);
	}

	return lines;
};
