import { formatIndexSummary } from "@/lib/schema-format";
import type { TableData } from "@/types";

export interface ColumnConstraintBadge {
	readonly id: string;
	readonly label: string;
	readonly title: string;
}

export const getColumnConstraintBadges = (table: TableData) => {
	const badgesByColumn = new Map<string, ColumnConstraintBadge[]>();

	for (const index of table.indexes) {
		if (index.kind !== "unique" || index.columns.length <= 1) {
			continue;
		}

		const title = [
			formatIndexSummary(index),
			index.name ? `Constraint ${index.name}` : null,
			index.note ?? null,
		]
			.filter(Boolean)
			.join(" · ");

		for (const column of index.columns) {
			const badges = badgesByColumn.get(column) ?? [];
			badges.push({
				id: `${index.id}:${column}`,
				label: "UQ",
				title,
			});
			badgesByColumn.set(column, badges);
		}
	}

	return badgesByColumn;
};
