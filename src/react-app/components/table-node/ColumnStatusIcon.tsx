import { IconKey, IconLink } from "@tabler/icons-react";

import { cn } from "@/lib/utils";

interface ColumnStatusIconProps {
	readonly isForeignKey: boolean;
	readonly isPrimaryKey: boolean;
	readonly isRelationActive: boolean;
}

export function ColumnStatusIcon({
	isForeignKey,
	isPrimaryKey,
	isRelationActive,
}: ColumnStatusIconProps) {
	if (isPrimaryKey && isForeignKey) {
		return (
			<span className="relative flex size-3.5 items-center justify-center">
				<IconKey className="size-3" />
				<IconLink className="absolute -right-1.5 -bottom-1 size-2.5 rounded-full bg-card" />
			</span>
		);
	}

	if (isPrimaryKey) {
		return <IconKey className="size-3" />;
	}

	if (isForeignKey) {
		return <IconLink className="size-3" />;
	}

	return (
		<span
			className={cn(
				"size-1 transition-colors duration-200 ease-out",
				isRelationActive ? "bg-primary" : "bg-border",
			)}
		/>
	);
}
