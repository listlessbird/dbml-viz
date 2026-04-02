import type { Edge, Node, XYPosition } from "@xyflow/react";

export const MAX_DBML_LENGTH = 500_000;

export interface SharePosition {
	readonly x: number;
	readonly y: number;
}

export interface EditorPosition {
	readonly line: number;
	readonly column: number;
}

export interface ParseDiagnostic {
	readonly message: string;
	readonly code?: number;
	readonly location?: {
		readonly start: EditorPosition;
		readonly end?: EditorPosition;
	};
}

export interface SchemaPayload {
	readonly dbml: string;
	readonly positions: Record<string, SharePosition>;
	readonly version: 1;
}

export interface ColumnData {
	readonly name: string;
	readonly type: string;
	readonly pk: boolean;
	readonly notNull: boolean;
	readonly unique: boolean;
	readonly isForeignKey: boolean;
	readonly note?: string;
}

export interface TableData {
	readonly id: string;
	readonly name: string;
	readonly schema?: string;
	readonly note?: string;
	readonly columns: readonly ColumnData[];
}

export type RefType = "one_to_one" | "one_to_many" | "many_to_one" | "many_to_many";

export interface RefData {
	readonly id: string;
	readonly from: {
		readonly table: string;
		readonly column: string;
	};
	readonly to: {
		readonly table: string;
		readonly column: string;
	};
	readonly type: RefType;
}

export interface ParsedSchema {
	readonly tables: readonly TableData[];
	readonly refs: readonly RefData[];
	readonly errors: readonly string[];
}

export type DiagramGridMode = "none" | "dots" | "lines";

export type DiagramLayoutAlgorithm = "left-right" | "snowflake" | "compact";

export interface DiagramNodeSize {
	readonly width: number;
	readonly height: number;
}

export type DiagramPositions = Record<string, XYPosition>;

export interface TableNodeData extends Record<string, unknown> {
	readonly table: TableData;
	readonly accent: string;
	readonly connectedColumns: readonly string[];
	readonly activeRelationColumns?: readonly string[];
	readonly isRelationContextActive?: boolean;
	readonly isSearchMatch: boolean;
	readonly isSearchRelated: boolean;
	readonly isSearchDimmed: boolean;
	readonly onMeasure?: (nodeId: string, size: DiagramNodeSize) => void;
}

export interface RelationshipEdgeData extends Record<string, unknown> {
	readonly from: {
		readonly table: string;
		readonly column: string;
	};
	readonly to: {
		readonly table: string;
		readonly column: string;
	};
	readonly relationText: string;
	readonly isSearchMatch: boolean;
	readonly isSearchDimmed: boolean;
	readonly isRelationActive?: boolean;
	readonly isRelationSourceActive?: boolean;
	readonly isRelationTargetActive?: boolean;
}

export type DiagramNode = Node<TableNodeData, "table">;
export type DiagramEdge = Edge<RelationshipEdgeData, "relationship">;
