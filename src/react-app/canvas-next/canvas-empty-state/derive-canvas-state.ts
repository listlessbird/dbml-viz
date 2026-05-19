export type CanvasStateVariant =
	| "empty-source"
	| "invalid-source"
	| "zero-tables"
	| "layout-pending"
	| "ready";

export interface CanvasStateInputs {
	readonly isSourceEmpty: boolean;
	readonly diagnosticsCount: number;
	readonly tableCount: number;
	readonly isLayoutPending?: boolean;
}

export interface CanvasStateResult {
	readonly variant: CanvasStateVariant;
	readonly diagnosticsCount: number;
}

export const isSchemaSourceEmpty = (source: string): boolean =>
	source.trim().length === 0;

export function deriveCanvasState({
	isSourceEmpty,
	diagnosticsCount,
	tableCount,
	isLayoutPending = false,
}: CanvasStateInputs): CanvasStateResult {
	if (isSourceEmpty) {
		return { variant: "empty-source", diagnosticsCount: 0 };
	}
	if (diagnosticsCount > 0) {
		return { variant: "invalid-source", diagnosticsCount };
	}
	if (tableCount === 0) {
		return { variant: "zero-tables", diagnosticsCount: 0 };
	}
	if (isLayoutPending) {
		return { variant: "layout-pending", diagnosticsCount: 0 };
	}
	return { variant: "ready", diagnosticsCount: 0 };
}
