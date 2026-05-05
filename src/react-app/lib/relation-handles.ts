export const getSourceHandleId = (tableId: string, columnName: string) =>
	`${tableId}-${columnName}-source`;

export const getTargetHandleId = (tableId: string, columnName: string) =>
	`${tableId}-${columnName}-target`;
