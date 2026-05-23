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
						className="nodrag nopan inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[4px] border border-transparent bg-transparent text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground focus-visible:border-border focus-visible:bg-muted focus-visible:text-foreground data-popup-open:border-[color-mix(in_oklab,var(--primary)_30%,var(--border))] data-popup-open:bg-[color-mix(in_oklab,var(--primary)_10%,var(--card))] data-popup-open:text-primary"
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
