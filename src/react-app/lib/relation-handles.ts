import type { RefData } from "@/types";

export const getSourceHandleId = (tableId: string, columnName: string) =>
	`${tableId}-${columnName}-source`;

export const getTargetHandleId = (tableId: string, columnName: string) =>
	`${tableId}-${columnName}-target`;

export const getRelationSourceHandleId = (refId: string) => `${refId}-source`;

export const getRelationTargetHandleId = (refId: string) => `${refId}-target`;

export const getRefSourceHandleId = (ref: RefData) =>
	ref.from.columns.length === 1
		? getSourceHandleId(ref.from.table, ref.from.columns[0])
		: getRelationSourceHandleId(ref.id);

export const getRefTargetHandleId = (ref: RefData) =>
	ref.to.columns.length === 1
		? getTargetHandleId(ref.to.table, ref.to.columns[0])
		: getRelationTargetHandleId(ref.id);
