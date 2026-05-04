import {
	Handle,
	NodeResizer,
	Position,
	useReactFlow,
	type NodeProps,
} from "@xyflow/react";
import {
	memo,
	useCallback,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type CSSProperties,
	type KeyboardEvent as ReactKeyboardEvent,
	type MouseEvent as ReactMouseEvent,
} from "react";

import { LinksRow, ProseBody } from "@/canvas-next/sticky-note/body";
import { EditBar, Header, PaletteStrip } from "@/canvas-next/sticky-note/chrome";
import {
	parseLinksFromText,
	type LinkValidator,
	type StickyNoteLinkRef,
} from "@/canvas-next/sticky-note/link-tokens";
import { LinkerPopoverContent } from "@/canvas-next/sticky-note/linker-popover";
import {
	STICKY_NOTE_MIN_HEIGHT,
	STICKY_NOTE_MIN_WIDTH,
} from "@/canvas-next/sticky-note/measure";
import { useStickyLayout } from "@/canvas-next/sticky-note/use-sticky-layout";
import { useStickyLinker } from "@/canvas-next/sticky-note/use-sticky-linker";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { useDiagramSession } from "@/diagram-session/diagram-session-context";
import type {
	CanvasNode,
	StickyNoteColor,
	StickyNoteNode as StickyNoteNodeType,
	StickyNoteWidthMode,
	TableData,
} from "@/types";

const ROOT_STYLE: CSSProperties = {
	minWidth: STICKY_NOTE_MIN_WIDTH,
	minHeight: STICKY_NOTE_MIN_HEIGHT,
};

const LINK_HANDLE_STYLE: CSSProperties = {
	top: "50%",
	right: 0,
	transform: "translate(50%, -50%)",
	width: 1,
	height: 1,
	minWidth: 0,
	minHeight: 0,
	border: "none",
	background: "transparent",
	opacity: 0,
	pointerEvents: "none",
};

const colorClasses: Record<StickyNoteColor, string> = {
	yellow: "border-yellow-300 bg-yellow-100 text-yellow-950",
	pink: "border-pink-300 bg-pink-100 text-pink-950",
	blue: "border-sky-300 bg-sky-100 text-sky-950",
	green: "border-emerald-300 bg-emerald-100 text-emerald-950",
};

const buildTableValidator = (
	tables: readonly TableData[],
): LinkValidator => {
	const map = new Map<string, ReadonlySet<string>>();
	for (const table of tables) {
		map.set(table.name, new Set(table.columns.map((c) => c.name)));
	}
	return (table, column) => {
		const cols = map.get(table);
		if (!cols) return false;
		if (column && !cols.has(column)) return false;
		return true;
	};
};

const renderPopoverAnchor = (
	props: React.HTMLAttributes<HTMLSpanElement>,
) => (
	<span
		{...props}
		aria-hidden
		tabIndex={-1}
		className="pointer-events-none absolute inset-x-2 bottom-2 h-0"
	/>
);

const resolveWidthMode = (
	mode: StickyNoteWidthMode | undefined,
): StickyNoteWidthMode => mode ?? "auto";

export const CanvasNextStickyNoteNode = memo(function CanvasNextStickyNoteNode({
	id,
	data,
	selected,
	width,
	height,
}: NodeProps<StickyNoteNodeType>) {
	const note = data.note;
	const tables = useDiagramSession(
		(state) => state.diagram.parsedSchema.tables,
	);
	const updateStickyNote = useDiagramSession((state) => state.updateStickyNote);
	const deleteStickyNote = useDiagramSession((state) => state.deleteStickyNote);
	const reactFlow = useReactFlow<CanvasNode>();
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);

	const text = note?.text ?? "";
	const widthMode = resolveWidthMode(note?.widthMode);
	const currentWidth = width ?? note?.width ?? STICKY_NOTE_MIN_WIDTH;
	const [isEditing, setIsEditing] = useState(() => text.length === 0);
	const linker = useStickyLinker({
		id,
		textareaRef,
		selected: Boolean(selected),
	});

	const isValidRef = useMemo(() => buildTableValidator(tables), [tables]);
	const links = useMemo(
		() => parseLinksFromText(text, isValidRef),
		[text, isValidRef],
	);
	const layout = useStickyLayout({
		id,
		text,
		isEditing,
		selected: Boolean(selected),
		widthMode,
		currentWidth,
		links,
		isValidRef,
	});

	useLayoutEffect(() => {
		if (text.length === 0) textareaRef.current?.focus();
		// Mount-only focus for freshly-created notes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const enterEditMode = useCallback(() => {
		setIsEditing(true);
		requestAnimationFrame(() => textareaRef.current?.focus());
	}, []);

	const handleTextareaKey = useCallback(
		(event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
			if (event.key === "Escape") {
				event.preventDefault();
				event.currentTarget.blur();
				setIsEditing(false);
				linker.setOpen(false);
			}
		},
		[linker],
	);

	const handleBlur = useCallback(() => {
		if (!linker.open) setIsEditing(false);
	}, [linker.open]);

	const handleColorPick = useCallback(
		(color: StickyNoteColor) => {
			updateStickyNote(id, { color });
		},
		[id, updateStickyNote],
	);

	const handleDelete = useCallback(() => {
		deleteStickyNote(id);
	}, [id, deleteStickyNote]);

	const handleChipClick = useCallback(
		(ref: StickyNoteLinkRef) => {
			const target = tables.find((table) => table.name === ref.table);
			if (!target) return;
			const node = reactFlow.getNode(target.id);
			const layoutWidth = node?.measured?.width ?? node?.width ?? 200;
			const layoutHeight = node?.measured?.height ?? node?.height ?? 120;
			const x = (node?.position?.x ?? 0) + layoutWidth / 2;
			const y = (node?.position?.y ?? 0) + layoutHeight / 2;
			void reactFlow.setCenter(x, y, { duration: 320, zoom: 1 });
		},
		[reactFlow, tables],
	);

	const stopPropagation = useCallback(
		(event: { stopPropagation: () => void }) => {
			event.stopPropagation();
		},
		[],
	);

	const renderedHeight = height ?? layout.nodeHeight;
	const renderedWidth = layout.nodeWidth;

	if (!note) return null;

	return (
		<div
			data-testid="sticky-note-root"
			data-color={note.color}
			data-selected={selected}
			data-width-mode={widthMode}
			className={`group/sticky relative flex h-full min-h-24 w-full min-w-36 flex-col overflow-hidden border font-sans shadow-sm ${colorClasses[note.color]}`}
			style={{
				...ROOT_STYLE,
				width: renderedWidth,
				height: renderedHeight,
			}}
			onDoubleClick={(event: ReactMouseEvent) => {
				event.stopPropagation();
				enterEditMode();
			}}
		>
			<NodeResizer
				isVisible={selected}
				minWidth={STICKY_NOTE_MIN_WIDTH}
				minHeight={STICKY_NOTE_MIN_HEIGHT}
				lineClassName="!border-current/40"
				handleClassName="!size-2 !border !border-current/50 !bg-background"
				onResizeEnd={(_, params) => {
					updateStickyNote(id, {
						width: params.width,
						height: params.height,
						widthMode: "manual",
					});
				}}
			/>
			<Handle
				type="source"
				position={Position.Right}
				isConnectable={false}
				style={LINK_HANDLE_STYLE}
			/>

			<Header kind={isEditing ? "EDITING" : "NOTE"} />

			<div className="relative flex min-h-0 flex-1 flex-col">
				{isEditing ? (
					<textarea
						ref={textareaRef}
						value={text}
						onChange={linker.handleChangeText}
						onKeyDown={handleTextareaKey}
						onFocus={() => setIsEditing(true)}
						onBlur={handleBlur}
						onPointerDown={stopPropagation}
						spellCheck={false}
						placeholder="Write a note… type # to link a table"
						style={{ height: layout.textareaBoxH }}
						className="sticky-note__textarea nodrag nowheel m-2 block w-auto resize-none border border-dashed bg-white/50 px-2 pt-2 pb-1 font-sans text-[13px] leading-5 outline-none placeholder:text-current/40"
					/>
				) : (
					<ProseBody
						text={text}
						links={links}
						isValidRef={isValidRef}
						onChipClick={handleChipClick}
						onClick={enterEditMode}
					/>
				)}
				<Popover open={linker.open} onOpenChange={linker.setOpen}>
					<PopoverTrigger render={renderPopoverAnchor} />
					{linker.open && (
						<LinkerPopoverContent
							tables={tables}
							stage={linker.stage}
							scopedTable={linker.scopedTable}
							onPickTable={linker.handlePickTable}
							onPickColumn={linker.handlePickColumn}
							onBackToTables={linker.resetToTables}
							onClose={() => {
								linker.setOpen(false);
								textareaRef.current?.focus();
							}}
						/>
					)}
				</Popover>
			</div>

			{!isEditing && links.length > 0 && (
				<LinksRow links={links} onChipClick={handleChipClick} />
			)}

			{isEditing ? (
				<EditBar onDelete={handleDelete} />
			) : (
				selected && (
					<PaletteStrip
						active={note.color}
						onPick={handleColorPick}
						onStopPropagation={stopPropagation}
					/>
				)
			)}
		</div>
	);
});
