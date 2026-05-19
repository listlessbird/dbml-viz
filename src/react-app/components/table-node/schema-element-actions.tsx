import {
	IconCopy,
	IconFileText,
	IconNotes,
	IconTargetArrow,
} from "@tabler/icons-react";
import type { ComponentType, SVGProps } from "react";

import type { CanvasRuntimeStore } from "@/canvas-next/canvas-runtime-store";
import type { SourceFocusStore } from "@/canvas-next/source-focus/source-focus-store";
import {
	DropdownMenuItem,
	DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { spawnStickyNoteForTable } from "@/components/table-node/spawn-linked-sticky";
import type { DiagramSessionStore } from "@/diagram-session/diagram-session-store";
import { copyTextToClipboard } from "@/lib/copy-clipboard";
import { getTableMarkdown } from "@/lib/table-markdown";
import type { TableData } from "@/types";

export interface SchemaElementAction {
	readonly id: string;
	readonly label: string;
	readonly icon: ComponentType<SVGProps<SVGSVGElement>>;
	readonly onSelect: () => void;
	readonly dividerBefore?: boolean;
}

interface BuildTableActionsInput {
	readonly table: TableData;
	readonly runtimeStore: CanvasRuntimeStore;
	readonly sourceFocusStore: SourceFocusStore;
	readonly sessionStore: DiagramSessionStore;
}

export function buildTableActions({
	table,
	runtimeStore,
	sourceFocusStore,
	sessionStore,
}: BuildTableActionsInput): readonly SchemaElementAction[] {
	const actions: SchemaElementAction[] = [
		{
			id: "copy-name",
			label: "Copy table name",
			icon: IconCopy,
			onSelect: () => {
				void copyTextToClipboard(table.name);
			},
		},
		{
			id: "copy-markdown",
			label: "Copy as Markdown",
			icon: IconFileText,
			onSelect: () => {
				void copyTextToClipboard(getTableMarkdown(table));
			},
		},
	];
	if (table.name.length > 0) {
		actions.push({
			id: "focus-source",
			label: "Focus in Schema Source",
			icon: IconTargetArrow,
			dividerBefore: true,
			onSelect: () => {
				sourceFocusStore
					.getState()
					.requestSourceFocus({ tableName: table.name });
			},
		});
	}
	actions.push({
		id: "add-sticky-note",
		label: "Add sticky note for table",
		icon: IconNotes,
		onSelect: () => {
			const runtime = runtimeStore.getState();
			const session = sessionStore.getState();
			spawnStickyNoteForTable({
				flowInstance: runtime.flowInstance,
				addStickyNote: session.addStickyNote,
				table,
				tablePositions: session.diagram.tablePositions,
			});
		},
	});
	return actions;
}

interface BuildColumnActionsInput {
	readonly tableName: string;
	readonly columnName: string;
	readonly sourceFocusStore: SourceFocusStore;
}

export function buildColumnActions({
	tableName,
	columnName,
	sourceFocusStore,
}: BuildColumnActionsInput): readonly SchemaElementAction[] {
	const actions: SchemaElementAction[] = [
		{
			id: "copy-name",
			label: "Copy column name",
			icon: IconCopy,
			onSelect: () => {
				void copyTextToClipboard(columnName);
			},
		},
	];
	if (tableName.length > 0 && columnName.length > 0) {
		actions.push({
			id: "focus-source",
			label: "Focus in Schema Source",
			icon: IconTargetArrow,
			onSelect: () => {
				sourceFocusStore
					.getState()
					.requestSourceFocus({ tableName, columnName });
			},
		});
	}
	return actions;
}

interface SchemaElementActionItemsProps {
	readonly actions: readonly SchemaElementAction[];
}

export function SchemaElementActionItems({
	actions,
}: SchemaElementActionItemsProps) {
	return (
		<>
			{actions.map((action) => (
				<RenderedAction key={action.id} action={action} />
			))}
		</>
	);
}

function RenderedAction({ action }: { readonly action: SchemaElementAction }) {
	const Icon = action.icon;
	return (
		<>
			{action.dividerBefore ? <DropdownMenuSeparator /> : null}
			<DropdownMenuItem onClick={action.onSelect}>
				<Icon className="size-3.5" aria-hidden />
				{action.label}
			</DropdownMenuItem>
		</>
	);
}
