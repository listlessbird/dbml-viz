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
	const activeRelationColumns = new Set(data.activeRelationColumns ?? []);
	const headerStyle = {
		backgroundColor: `color-mix(in oklab, ${data.accent} 76%, var(--foreground))`,
		color: "var(--background)",
	} satisfies CSSProperties;
	const badgeStyle = {
		borderColor: "color-mix(in oklab, var(--background) 18%, transparent)",
		backgroundColor: "color-mix(in oklab, var(--background) 12%, transparent)",
		color: "var(--background)",
	} satisfies CSSProperties;
	const surfaceStyle = {
		boxShadow: selected || data.isSearchMatch
			? `0 0 0 1px ${data.accent}, 0 0 0 3px color-mix(in oklab, ${data.accent} 18%, transparent), 0 20px 44px color-mix(in oklab, var(--foreground) 18%, transparent)`
			: data.isRelationContextActive
				? "0 0 0 1px color-mix(in oklab, var(--primary) 18%, var(--border)), 0 18px 38px color-mix(in oklab, var(--primary) 12%, transparent)"
			: data.isSearchRelated
				? "0 0 0 1px color-mix(in oklab, var(--primary) 28%, var(--border)), 0 16px 36px color-mix(in oklab, var(--foreground) 14%, transparent)"
				: "0 0 0 1px color-mix(in oklab, var(--foreground) 8%, transparent), 0 14px 34px color-mix(in oklab, var(--foreground) 12%, transparent)",
		opacity: data.isSearchDimmed ? 0.32 : 1,
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
				"w-[320px] overflow-hidden border border-border bg-card text-card-foreground hover:cursor-move",
			)}
			style={surfaceStyle}
		>
			<div
				className="border-b border-border px-4 py-3"
				style={headerStyle}
			>
				<div className="flex items-end justify-between gap-3">
					<div>
						<h3 className="text-[1rem] font-semibold tracking-tight text-inherit">
							{data.table.name}
						</h3>
					</div>
					<span
						className="border px-2 py-1 text-[0.68rem] uppercase tracking-[0.18em]"
						style={badgeStyle}
					>
						{data.table.columns.length} cols
					</span>
				</div>
				{data.table.note ? (
					<p className="mt-2 max-w-[28ch] text-xs" style={{ opacity: 0.82 }}>
						{data.table.note}
					</p>
				) : null}
			</div>

			<div className="divide-y divide-border">
				{data.table.columns.map((column) => {
					const isConnected = connectedColumns.has(column.name);
					const isRelationActiveColumn = activeRelationColumns.has(column.name);
					const rowStyle = isRelationActiveColumn
						? {
								backgroundColor:
									"color-mix(in oklab, var(--primary) 12%, var(--background))",
								boxShadow:
									"inset 3px 0 0 color-mix(in oklab, var(--primary) 56%, transparent)",
							}
						: undefined;
					const typeBadgeStyle = isRelationActiveColumn
						? {
								borderColor:
									"color-mix(in oklab, var(--primary) 32%, var(--border))",
								backgroundColor:
									"color-mix(in oklab, var(--primary) 10%, var(--background))",
							}
						: undefined;

					return (
						<div
							key={column.name}
							className={cn(
								"group/row relative flex min-h-9 items-center gap-3 px-4 py-2.5 transition-[background-color,box-shadow,color] duration-200 ease-out",
								isRelationActiveColumn ? "hover:bg-transparent" : "hover:bg-muted/40",
							)}
							style={rowStyle}
						>
							<Handle
								id={getTargetHandleId(data.table.id, column.name)}
								type="target"
								position={Position.Left}
								isConnectable={false}
								className={cn(
									"!size-2.5 !border-0 !bg-primary !shadow-none transition-opacity",
									isConnected || isRelationActiveColumn
										? "!opacity-100"
										: "!opacity-0 group-hover/row:!opacity-60",
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
									isConnected || isRelationActiveColumn
										? "!opacity-100"
										: "!opacity-0 group-hover/row:!opacity-60",
								)}
								style={{ right: -6, top: "50%", transform: "translateY(-50%)" }}
							/>

							<div className="mt-0.5 flex w-5 shrink-0 justify-center text-primary transition-colors duration-200 ease-out">
								{column.pk ? (
									<IconKey className="size-3.5" />
								) : column.isForeignKey ? (
									<IconLink className="size-3.5" />
								) : (
									<span
										className={cn(
											"size-1.5 transition-colors duration-200 ease-out",
											isRelationActiveColumn ? "bg-primary" : "bg-border",
										)}
									/>
								)}
							</div>

							<div className="min-w-0 flex-1">
								<p
									className={cn(
										"truncate text-sm font-medium transition-colors duration-200 ease-out",
										isRelationActiveColumn
											? "text-foreground"
											: "text-card-foreground",
									)}
								>
									{column.name}
								</p>
								{column.note ? (
									<p
										className={cn(
											"truncate text-[0.72rem] transition-colors duration-200 ease-out",
											isRelationActiveColumn
												? "text-foreground/70"
												: "text-muted-foreground",
										)}
									>
										{column.note}
									</p>
								) : null}
							</div>

							<div
								className={cn(
									"flex flex-col items-end gap-1 text-[0.7rem] transition-colors duration-200 ease-out",
									isRelationActiveColumn
										? "text-foreground/70"
										: "text-muted-foreground",
								)}
							>
								<span
									className={cn(
										"border border-border px-2 py-0.5 font-medium transition-colors duration-200 ease-out",
										isRelationActiveColumn
											? "text-foreground"
											: "text-card-foreground",
									)}
									style={typeBadgeStyle}
								>
									{column.type}
								</span>
								<span
									className={cn(
										"text-[0.62rem] uppercase tracking-[0.18em] transition-colors duration-200 ease-out",
										isRelationActiveColumn
											? "text-foreground/70"
											: "text-muted-foreground",
									)}
								>
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
