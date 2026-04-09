import { cn } from "@/lib/utils";
import type { ColumnConstraintBadge } from "@/lib/table-constraints";

interface ColumnConstraintBadgesProps {
	readonly badges: readonly ColumnConstraintBadge[];
	readonly isActive: boolean;
}

export function ColumnConstraintBadges({
	badges,
	isActive,
}: ColumnConstraintBadgesProps) {
	if (badges.length === 0) {
		return null;
	}

	return (
		<div className="mt-1 flex flex-wrap gap-1">
			{badges.map((badge) => (
				<span
					key={badge.id}
					title={badge.title}
					className={cn(
						"schema-table-chip inline-flex min-h-4 items-center border px-1.5 py-0 text-[0.52rem] font-semibold tracking-[0.16em] uppercase",
						isActive
							? "border-primary/30 bg-primary/8 text-foreground/72"
							: "border-border/70 bg-background/78 text-muted-foreground/82",
					)}
				>
					{badge.label}
				</span>
			))}
		</div>
	);
}
