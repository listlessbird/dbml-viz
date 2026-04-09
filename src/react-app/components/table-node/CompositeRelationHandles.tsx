import { Handle, Position } from "@xyflow/react";

import { cn } from "@/lib/utils";
import type { RelationAnchorData } from "@/types";

interface CompositeRelationHandlesProps {
	readonly activeColumns: ReadonlySet<string>;
	readonly connectedColumns: ReadonlySet<string>;
	readonly relationAnchors: readonly RelationAnchorData[];
	readonly topOffsets: Readonly<Record<string, number>>;
}

export function CompositeRelationHandles({
	activeColumns,
	connectedColumns,
	relationAnchors,
	topOffsets,
}: CompositeRelationHandlesProps) {
	return relationAnchors
		.filter((anchor) => anchor.columns.length > 1)
		.map((anchor) => {
			const isVisible = anchor.columns.some(
				(column) => activeColumns.has(column) || connectedColumns.has(column),
			);

			return (
				<Handle
					key={anchor.id}
					id={anchor.id}
					type={anchor.side}
					position={anchor.side === "source" ? Position.Right : Position.Left}
					isConnectable={false}
					className={cn(
						"!size-2.5 !border-0 !bg-primary !shadow-none transition-opacity",
						isVisible ? "!opacity-100" : "!opacity-0",
					)}
					style={{
						[anchor.side === "source" ? "right" : "left"]: -6,
						top: topOffsets[anchor.id] ?? 0,
						transform: "translateY(-50%)",
					}}
				/>
			);
		});
}
