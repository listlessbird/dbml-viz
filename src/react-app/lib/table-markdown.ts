import type { ColumnData, TableData } from "@/types";

const CELL_PIPE_PATTERN = /\|/g;
const escapeCell = (value: string) => value.replace(CELL_PIPE_PATTERN, "\\|");

const formatFlags = (column: ColumnData): string => {
	const flags: string[] = [];
	if (column.pk) flags.push("PK");
	if (column.isForeignKey) flags.push("FK");
	if (column.unique) flags.push("UNIQUE");
	if (column.notNull) flags.push("NOT NULL");
	if (column.isIndexed && !column.pk && !column.unique) flags.push("INDEXED");
	return flags.join(", ");
};

export function getTableMarkdown(table: TableData): string {
	const heading = table.schema
		? `### ${table.schema}.${table.name}`
		: `### ${table.name}`;
	const headerRow = "| Column | Type | Constraints | Note |";
	const dividerRow = "| --- | --- | --- | --- |";
	const rows = table.columns.map((column) => {
		const cells = [
			column.name,
			column.type,
			formatFlags(column),
			column.note ?? "",
		].map((cell) => escapeCell(cell));
		return `| ${cells.join(" | ")} |`;
	});
	return [heading, "", headerRow, dividerRow, ...rows].join("\n");
}
