import type { RefData, RefEndpointData } from "@/types";

export interface RelationAnchor {
	readonly id: string;
	readonly tableId: string;
	readonly columns: readonly string[];
	readonly side: "source" | "target";
}

export interface ResolvedRelationship {
	readonly ref: RefData;
	readonly from: RelationAnchor;
	readonly to: RelationAnchor;
}

const singleColumnAnchorId = (
	tableId: string,
	columnName: string,
	side: RelationAnchor["side"],
) => `${tableId}-${columnName}-${side}`;

const compositeAnchorId = (refId: string, side: RelationAnchor["side"]) =>
	`${refId}-${side}`;

const buildAnchor = (
	ref: RefData,
	endpoint: RefEndpointData,
	side: RelationAnchor["side"],
): RelationAnchor => ({
	id:
		endpoint.columns.length === 1
			? singleColumnAnchorId(endpoint.table, endpoint.columns[0]!, side)
			: compositeAnchorId(ref.id, side),
	tableId: endpoint.table,
	columns: endpoint.columns,
	side,
});

export const resolveRelationship = (ref: RefData): ResolvedRelationship => ({
	ref,
	from: buildAnchor(ref, ref.from, "source"),
	to: buildAnchor(ref, ref.to, "target"),
});
