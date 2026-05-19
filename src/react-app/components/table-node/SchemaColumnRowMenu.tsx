import { IconDots } from "@tabler/icons-react";
import { memo, useMemo } from "react";

import { useSourceFocusStore } from "@/canvas-next/source-focus/source-focus-context";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SchemaElementActionItems,
	buildColumnActions,
} from "@/components/table-node/schema-element-actions";
import { cn } from "@/lib/utils";

interface SchemaColumnRowMenuProps {
	readonly tableName: string;
	readonly columnName: string;
}

export const SchemaColumnRowMenu = memo(function SchemaColumnRowMenu({
	tableName,
	columnName,
}: SchemaColumnRowMenuProps) {
	const sourceFocusStore = useSourceFocusStore();

	const actions = useMemo(
		() => buildColumnActions({ tableName, columnName, sourceFocusStore }),
		[tableName, columnName, sourceFocusStore],
	);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<button
						type="button"
						aria-label={`Open ${columnName} actions`}
						className={cn(
							"nodrag nopan inline-flex h-5 w-5 shrink-0 items-center justify-center border border-transparent text-muted-foreground transition-opacity",
							"pointer-events-none opacity-0 group-hover/row:pointer-events-auto group-hover/row:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 data-popup-open:pointer-events-auto data-popup-open:opacity-100",
							"hover:border-border hover:bg-muted hover:text-foreground",
						)}
					>
						<IconDots className="size-3" aria-hidden />
					</button>
				}
			/>
			<DropdownMenuContent align="end" sideOffset={6} className="min-w-48">
				<SchemaElementActionItems actions={actions} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
});
