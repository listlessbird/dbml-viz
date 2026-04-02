import { IconKey, IconLink } from "@tabler/icons-react";
import { type CSSProperties, memo, useLayoutEffect, useRef } from "react";
import { useEffectEvent } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

import { getSourceHandleId, getTargetHandleId } from "@/lib/transform";
import { cn } from "@/lib/utils";
import type { DiagramNode } from "@/types";

export const TableNode = memo(function TableNode({
	id,
	data,
	selected,
}: NodeProps<DiagramNode>) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const connectedColumns = new Set(data.connectedColumns);
	const surfaceStyle = {
		boxShadow: selected
			? "0 0 0 1px var(--ring), 0 0 0 3px color-mix(in oklab, var(--ring) 14%, transparent), 0 18px 44px color-mix(in oklab, var(--foreground) 18%, transparent)"
			: "0 0 0 1px color-mix(in oklab, var(--foreground) 8%, transparent), 0 14px 36px color-mix(in oklab, var(--foreground) 12%, transparent)",
	} satisfies CSSProperties;

	const reportMeasurement = useEffectEvent(() => {
		const element = containerRef.current;
		if (!element || !data.onMeasure) {
			return;
		}

		data.onMeasure(id, {
			width: Math.round(element.getBoundingClientRect().width),
			height: Math.round(element.getBoundingClientRect().height),
		});
	});

	useLayoutEffect(() => {
		reportMeasurement();

		const element = containerRef.current;
		if (!element) {
			return;
		}

		const observer = new ResizeObserver(() => {
			reportMeasurement();
		});

		observer.observe(element);

		return () => {
			observer.disconnect();
		};
	}, []);

	return (
		<div
			ref={containerRef}
			className={cn(
				"w-[320px] overflow-hidden border border-border bg-card text-card-foreground",
			)}
			style={surfaceStyle}
		>
			<div
				className="border-b border-border px-4 py-3"
				style={
					{
						backgroundColor: "color-mix(in oklab, var(--card) 78%, var(--muted))",
					} satisfies CSSProperties
				}
			>
				<div className="flex items-end justify-between gap-3">
					<div>
						<h3 className="text-[1rem] font-semibold tracking-tight text-foreground">
							{data.table.name}
						</h3>
					</div>
					<span className="border border-border bg-background/70 px-2 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-muted-foreground">
						{data.table.columns.length} cols
					</span>
				</div>
				{data.table.note ? (
					<p className="mt-2 max-w-[28ch] text-xs text-foreground/72">{data.table.note}</p>
				) : null}
			</div>

			<div className="divide-y divide-border">
				{data.table.columns.map((column) => {
					const isConnected = connectedColumns.has(column.name);

					return (
						<div
							key={column.name}
							className="group/row relative flex min-h-9 items-center gap-3 px-4 py-2.5 hover:bg-muted/40"
						>
							<Handle
								id={getTargetHandleId(data.table.id, column.name)}
								type="target"
								position={Position.Left}
								isConnectable={false}
								className={cn(
									"!size-2.5 !border-0 !bg-primary !shadow-none transition-opacity",
									isConnected ? "!opacity-100" : "!opacity-0 group-hover/row:!opacity-60",
								)}
								style={{ left: -6, top: "50%", transform: "translateY(-50%)" }}
							/>
							<Handle
								id={getSourceHandleId(data.table.id, column.name)}
								type="source"
								position={Position.Right}
								isConnectable={false}
								className={cn(
									"!size-2.5 !border-0 !bg-primary !shadow-none transition-opacity",
									isConnected ? "!opacity-100" : "!opacity-0 group-hover/row:!opacity-60",
								)}
								style={{ right: -6, top: "50%", transform: "translateY(-50%)" }}
							/>

							<div className="mt-0.5 flex w-5 shrink-0 justify-center text-primary">
								{column.pk ? (
									<IconKey className="size-3.5" />
								) : column.isForeignKey ? (
									<IconLink className="size-3.5" />
								) : (
									<span className="size-1.5 bg-border" />
								)}
							</div>

							<div className="min-w-0 flex-1">
								<p className="truncate text-sm font-medium text-card-foreground">
									{column.name}
								</p>
								{column.note ? (
									<p className="truncate text-[0.72rem] text-muted-foreground">{column.note}</p>
								) : null}
							</div>

								<div className="flex flex-col items-end gap-1 text-[0.7rem] text-muted-foreground">
									<span className="border border-border px-2 py-0.5 font-medium text-card-foreground">
										{column.type}
									</span>
									<span className="text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">
										{column.notNull ? "NOT NULL" : "NULLABLE"}
										{column.unique ? " · UNIQUE" : ""}
									</span>
								</div>
						</div>
					);
				})}
			</div>
		</div>
	);
});
