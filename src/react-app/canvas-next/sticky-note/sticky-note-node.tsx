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
import { LinkerMentionList } from "@/canvas-next/sticky-note/linker-popover";
import {
	STICKY_NOTE_MIN_HEIGHT,
	STICKY_NOTE_MIN_WIDTH,
} from "@/canvas-next/sticky-note/measure";
import { useStickyLayout } from "@/canvas-next/sticky-note/use-sticky-layout";
import {
	Mention,
	MentionContent,
	MentionInput,
} from "@/components/ui/mention";
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
	const currentHeight = height ?? note?.height ?? STICKY_NOTE_MIN_HEIGHT;
	const [isEditing, setIsEditing] = useState(() => text.length === 0);

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
		currentHeight,
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

	const handleChangeText = useCallback(
		(value: string) => {
			updateStickyNote(id, { text: value });
		},
		[id, updateStickyNote],
	);

	const handleTextareaKey = useCallback(
		(event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
			if (event.key === "Escape") {
				// If mention is open, the mention component will stop propagation.
				// If we get here, mention is either closed or it didn't stop propagation.
				if (text.trim().length === 0) {
					event.preventDefault();
					deleteStickyNote(id);
				} else {
					// We let the textarea blur normally, or we explicitly blur it.
					event.currentTarget.blur();
					setIsEditing(false);
				}
			}
		},
		[text, deleteStickyNote, id],
	);

	const handleBlur = useCallback(() => {
		if (text.trim().length === 0) {
			deleteStickyNote(id);
		} else {
			setIsEditing(false);
		}
	}, [text, deleteStickyNote, id]);

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

	const renderedHeight =
		widthMode === "manual"
			? Math.max(currentHeight, layout.nodeHeight)
			: layout.nodeHeight;
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
					<Mention
						trigger="#"
						inputValue={text}
						onInputValueChange={handleChangeText}
						className="block min-w-0 p-2 **:data-tag:rounded-none **:data-tag:bg-transparent **:data-tag:p-0 **:data-tag:text-transparent dark:**:data-tag:bg-transparent dark:**:data-tag:text-transparent"
					>
						<MentionInput asChild>
							<textarea
								ref={textareaRef}
								value={text}
								onKeyDown={handleTextareaKey}
								onFocus={() => setIsEditing(true)}
								onBlur={handleBlur}
								onPointerDown={stopPropagation}
								spellCheck={false}
								placeholder="Write a note… type # to link a table"
								style={{ height: layout.textareaBoxH }}
								className="sticky-note__textarea nodrag nowheel block w-full min-w-0 resize-none overflow-hidden border border-dashed bg-white/50 px-2! pt-2! pb-1! font-sans text-[13px]! leading-5! outline-none wrap-break-word placeholder:text-current/40"
							/>
						</MentionInput>
						<MentionContent className="w-60 gap-0 border border-border bg-popover p-0 font-sans shadow-lg">
							<LinkerMentionList tables={tables} />
						</MentionContent>
					</Mention>
				) : (
					<ProseBody
						text={text}
						links={links}
						isValidRef={isValidRef}
						onChipClick={handleChipClick}
						onClick={enterEditMode}
					/>
				)}
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
