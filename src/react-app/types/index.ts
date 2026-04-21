import type { Edge, Node, XYPosition } from "@xyflow/react";

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

export const MAX_SCHEMA_SOURCE_LENGTH = 500_000;

export type SchemaSourceFormat = "dbml" | "sql";

export type SqlDialect = "postgres" | "mysql" | "mssql" | "oracle" | "snowflake";

export interface SchemaSourceMetadata {
	readonly format: SchemaSourceFormat;
	readonly dialect?: SqlDialect;
}

export interface SharedStickyNote {
	readonly id: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly color: StickyNoteColor;
	readonly text: string;
}

export interface SchemaPayload {
	readonly source: string;
	readonly positions: Record<string, SharePosition>;
	readonly notes: readonly SharedStickyNote[];
	readonly version: 3;
}

export interface ColumnData {
	readonly name: string;
	readonly type: string;
	readonly pk: boolean;
	readonly notNull: boolean;
	readonly unique: boolean;
	readonly isForeignKey: boolean;
	readonly isIndexed: boolean;
	readonly note?: string;
}

export type TableIndexKind = "primary" | "unique" | "index";

export interface TableIndexData {
	readonly id: string;
	readonly kind: TableIndexKind;
	readonly columns: readonly string[];
	readonly name?: string;
	readonly method?: string;
	readonly note?: string;
}

export interface TableData {
	readonly id: string;
	readonly name: string;
	readonly schema?: string;
	readonly note?: string;
	readonly columns: readonly ColumnData[];
	readonly indexes: readonly TableIndexData[];
}

export type RefType = "one_to_one" | "one_to_many" | "many_to_one" | "many_to_many";

export interface RefEndpointData {
	readonly table: string;
	readonly columns: readonly string[];
}

export interface RefData {
	readonly id: string;
	readonly from: RefEndpointData;
	readonly to: RefEndpointData;
	readonly type: RefType;
	readonly name?: string;
	readonly onDelete?: string;
	readonly onUpdate?: string;
}

export interface ParsedSchema {
	readonly tables: readonly TableData[];
	readonly refs: readonly RefData[];
	readonly errors: readonly string[];
}

export type DiagramGridMode = "none" | "dots" | "lines";

export type DiagramLayoutAlgorithm = "left-right" | "snowflake" | "compact";

export type DiagramPositions = Record<string, XYPosition>;

export interface TableNodeLayout {
	readonly width: number;
	readonly height: number;
	readonly typeColumnWidth: number;
}

export interface RelationAnchorData {
	readonly id: string;
	readonly columns: readonly string[];
	readonly side: "source" | "target";
}

export interface TableNodeData extends Record<string, unknown> {
	readonly table: TableData;
	readonly layout: TableNodeLayout;
	readonly accent: string;
	readonly connectedColumns: readonly string[];
	readonly activeRelationColumns?: readonly string[];
	readonly isRelationContextActive?: boolean;
	readonly isSearchMatch: boolean;
	readonly isSearchRelated: boolean;
	readonly isSearchDimmed: boolean;
	readonly relationAnchors: readonly RelationAnchorData[];
	readonly compositeHandleOffsets: Readonly<Record<string, number>>;
}

export interface RelationshipEdgeData extends Record<string, unknown> {
	readonly from: RefEndpointData;
	readonly to: RefEndpointData;
	readonly relationText: string;
	readonly isSearchMatch: boolean;
	readonly isSearchDimmed: boolean;
	readonly isRelationActive?: boolean;
	readonly isRelationSourceActive?: boolean;
	readonly isRelationTargetActive?: boolean;
	readonly name?: string;
	readonly onDelete?: string;
	readonly onUpdate?: string;
}

export type DiagramNode = Node<TableNodeData, "table">;
export type DiagramEdge = Edge<RelationshipEdgeData, "relationship">;

export interface StickyLinkEdgeData extends Record<string, unknown> {
	readonly color: StickyNoteColor;
	readonly tableName: string;
	readonly columnName?: string;
}

export type StickyLinkEdge = Edge<StickyLinkEdgeData, "stickyLink">;

export const STICKY_NOTE_COLORS = ["yellow", "pink", "blue", "green"] as const;
export type StickyNoteColor = (typeof STICKY_NOTE_COLORS)[number];

export type StickyNoteData = Record<string, never>;

export type StickyNoteNode = Node<StickyNoteData, "sticky">;

export type CanvasNode = DiagramNode | StickyNoteNode;
export type CanvasEdge = DiagramEdge | StickyLinkEdge;
