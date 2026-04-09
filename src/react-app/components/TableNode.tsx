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
		backgroundColor: `color-mix(in oklab, ${data.accent} 14%, var(--card))`,
		borderBottomColor: `color-mix(in oklab, ${data.accent} 24%, var(--border))`,
	} satisfies CSSProperties;
	const headerTextStyle = {
		color: `color-mix(in oklab, ${data.accent} 70%, var(--foreground))`,
	} satisfies CSSProperties;
	const badgeStyle = {
		borderColor: `color-mix(in oklab, ${data.accent} 20%, var(--border))`,
		backgroundColor: `color-mix(in oklab, ${data.accent} 8%, var(--card))`,
		color: `color-mix(in oklab, ${data.accent} 50%, var(--muted-foreground))`,
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
				"w-fit min-w-[260px] max-w-[420px] overflow-hidden border border-border bg-card text-card-foreground hover:cursor-move",
			)}
			style={surfaceStyle}
		>
			<div
				className="border-b px-3 py-2"
				style={headerStyle}
			>
				<div className="flex items-center justify-between gap-2">
					<h3
						className="truncate text-[0.8rem] font-semibold tracking-tight"
						style={headerTextStyle}
					>
						{data.table.name}
					</h3>
					<span
						className="shrink-0 border px-1.5 py-0.5 text-[0.6rem] uppercase tracking-[0.12em]"
						style={badgeStyle}
					>
						{data.table.columns.length}
					</span>
				</div>
				{data.table.note ? (
					<p className="mt-1 truncate text-[0.65rem] text-muted-foreground">
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
								"group/row relative flex min-h-7 items-center gap-2 px-3 py-1.5 transition-[background-color,box-shadow,color] duration-200 ease-out",
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

							<div className="flex w-4 shrink-0 justify-center text-primary transition-colors duration-200 ease-out">
								{column.pk ? (
									<IconKey className="size-3" />
								) : column.isForeignKey ? (
									<IconLink className="size-3" />
								) : (
									<span
										className={cn(
											"size-1 transition-colors duration-200 ease-out",
											isRelationActiveColumn ? "bg-primary" : "bg-border",
										)}
									/>
								)}
							</div>

							<div className="min-w-0 flex-1">
								<p
									className={cn(
										"truncate text-xs font-medium transition-colors duration-200 ease-out",
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
											"truncate text-[0.65rem] transition-colors duration-200 ease-out",
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
									"flex flex-col items-end gap-0.5 text-[0.65rem] transition-colors duration-200 ease-out",
									isRelationActiveColumn
										? "text-foreground/70"
										: "text-muted-foreground",
								)}
							>
								<span
									className={cn(
										"max-w-[13rem] border border-border px-1.5 py-0.5 text-right font-medium whitespace-normal break-words transition-colors duration-200 ease-out",
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
										"text-[0.55rem] uppercase tracking-[0.12em] transition-colors duration-200 ease-out",
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
