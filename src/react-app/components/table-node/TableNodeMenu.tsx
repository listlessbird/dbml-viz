import { IconDots } from "@tabler/icons-react";
import { memo, useMemo } from "react";

import { useCanvasRuntimeStore } from "@/canvas-next/canvas-runtime-context";
import { useSourceFocusStore } from "@/canvas-next/source-focus/source-focus-context";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	SchemaElementActionItems,
	buildTableActions,
} from "@/components/table-node/schema-element-actions";
import { useDiagramSessionStore } from "@/diagram-session/diagram-session-context";
import { cn } from "@/lib/utils";
import type { TableData } from "@/types";

interface TableNodeMenuProps {
	readonly table: TableData;
}

export const TableNodeMenu = memo(function TableNodeMenu({
	table,
}: TableNodeMenuProps) {
	const runtimeStore = useCanvasRuntimeStore();
	const sourceFocusStore = useSourceFocusStore();
	const sessionStore = useDiagramSessionStore();

	const actions = useMemo(
		() =>
			buildTableActions({
				table,
				runtimeStore,
				sourceFocusStore,
				sessionStore,
			}),
		[table, runtimeStore, sourceFocusStore, sessionStore],
	);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<button
						type="button"
						aria-label={`Open ${table.name} actions`}
						className={cn(
							"nodrag nopan absolute top-2 right-2 z-10 inline-flex h-6 w-6 items-center justify-center border border-transparent text-muted-foreground transition-opacity",
							"pointer-events-none opacity-0 group-hover/table:pointer-events-auto group-hover/table:opacity-100 focus-visible:pointer-events-auto focus-visible:opacity-100 data-[popup-open]:pointer-events-auto data-[popup-open]:opacity-100",
							"hover:border-border hover:bg-muted hover:text-foreground",
						)}
					>
						<IconDots className="size-3.5" aria-hidden />
					</button>
				}
			/>
			<DropdownMenuContent align="end" sideOffset={6} className="min-w-56">
				<SchemaElementActionItems actions={actions} />
			</DropdownMenuContent>
		</DropdownMenu>
	);
});
