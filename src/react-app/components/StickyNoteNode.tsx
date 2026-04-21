import {
	Handle,
	NodeResizer,
	Position,
	useReactFlow,
	useStore,
	type NodeProps,
	type ReactFlowState,
} from "@xyflow/react";
import {
	memo,
	useCallback,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
	type KeyboardEvent as ReactKeyboardEvent,
	type MouseEvent as ReactMouseEvent,
} from "react";

import { LinkerPopoverContent } from "@/components/sticky-note/LinkerPopover";
import {
	parseLinksFromText,
	type LinkValidator,
	type StickyNoteLinkRef,
} from "@/components/sticky-note/linkHelpers";
import {
	PLACEHOLDER_TEXT,
	STICKY_NOTE_MIN_HEIGHT,
	STICKY_NOTE_MIN_WIDTH,
} from "@/components/sticky-note/layout";
import {
	LinksRow,
	ProseBody,
} from "@/components/sticky-note/StickyNoteBody";
import {
	EditBar,
	Header,
	PaletteStrip,
} from "@/components/sticky-note/StickyNoteChrome";
import { useStickyLayout } from "@/components/sticky-note/useStickyLayout";
import { useStickyLinker } from "@/components/sticky-note/useStickyLinker";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { useStickyNotesStore } from "@/store/useStickyNotesStore";
import type {
	CanvasNode,
	StickyNoteColor,
	StickyNoteNode as StickyNoteNodeType,
} from "@/types";

// Hoisted: the root `<div>` style never changes across renders, so keep
// the object identity stable to avoid re-triggering downstream style
// diffing work on every re-render.
const ROOT_STYLE: React.CSSProperties = {
	minWidth: STICKY_NOTE_MIN_WIDTH,
	minHeight: STICKY_NOTE_MIN_HEIGHT,
	animation: "sticky-note-in 180ms cubic-bezier(0.215, 0.61, 0.355, 1) both",
};


const LINK_HANDLE_STYLE: React.CSSProperties = {
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

// Primitive signature of every table's schema. `useStore` defaults to
// Object.is, so when a drag or selection update fires, this string stays
// equal and subscribed sticky notes skip re-rendering. Only a real
// schema edit invalidates it.
const selectTableSignature = (state: ReactFlowState): string => {
	let sig = "";
	for (const node of state.nodeLookup.values()) {
		if (node.type !== "table") continue;
		const internal = node as unknown as CanvasNode;
		if (internal.type !== "table") continue;
		const t = internal.data.table;
		sig += `|${t.name}:${t.columns.map((c) => c.name).join(",")}`;
	}
	return sig;
};

function StickyNoteNodeComponent({
	id,
	selected,
	width,
}: NodeProps<StickyNoteNodeType>) {
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const text = useStickyNotesStore((state) => state.texts[id] ?? "");
	const color = useStickyNotesStore(
		(state) => state.notesById[id]?.color ?? "yellow",
	);

	// Fresh notes (no text) mount straight into edit mode so the textarea
	// renders immediately and we can focus it before paint.
	const [isEditing, setIsEditing] = useState(() => text.length === 0);
	const { setNodes, setCenter, getNodes } = useReactFlow<CanvasNode>();

	// Token validity index keyed on a primitive schema signature — drags,
	// selections, or position updates don't invalidate it; only table or
	// column renames/additions do. Tables themselves are read lazily via
	// getNodes() inside the memo.
	const tableSignature = useStore(selectTableSignature);
	const isValidRef = useMemo<LinkValidator>(() => {
		void tableSignature;
		const map = new Map<string, Set<string>>();
		for (const node of getNodes()) {
			if (node.type === "table") {
				const t = node.data.table;
				map.set(t.name, new Set(t.columns.map((c) => c.name)));
			}
		}
		return (table, column) => {
			const cols = map.get(table);
			if (!cols) return false;
			if (column && !cols.has(column)) return false;
			return true;
		};
	}, [tableSignature, getNodes]);

	const links = useMemo(
		() => parseLinksFromText(text, isValidRef),
		[text, isValidRef],
	);

	const linker = useStickyLinker(id, textareaRef, selected);
	const { textareaBoxH, nodeHeight } = useStickyLayout({
		id,
		text,
		width,
		isEditing,
		selected,
		links,
		isValidRef,
	});

	useLayoutEffect(() => {
		if (text.length === 0) textareaRef.current?.focus();
		// Mount-only focus for freshly-created notes.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleChangeColor = useCallback(
		(nextColor: StickyNoteColor) => {
			useStickyNotesStore.getState().updateColor(id, nextColor);
		},
		[id],
	);

	const handleDelete = useCallback(() => {
		useStickyNotesStore.getState().deleteNote(id);
	}, [id]);

	const handleChipClick = useCallback(
		(ref: StickyNoteLinkRef) => {
			const match = getNodes().find(
				(node) => node.type === "table" && node.data.table.name === ref.table,
			);
			if (!match) return;
			setNodes((nodes) =>
				nodes.map((node) =>
					node.id === match.id
						? { ...node, selected: true }
						: node.selected
							? { ...node, selected: false }
							: node,
				),
			);
			const x = (match.position?.x ?? 0) + (match.width ?? 200) / 2;
			const y = (match.position?.y ?? 0) + (match.height ?? 120) / 2;
			setCenter(x, y, { duration: 320, zoom: 1 });
		},
		[getNodes, setCenter, setNodes],
	);

	const stopPropagation = useCallback(
		(event: { stopPropagation: () => void }) => {
			event.stopPropagation();
		},
		[],
	);

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

	// textareaRef.current is often still null because the DOM hasn’t updated yet.
	const enterEditMode = useCallback(() => {
		setIsEditing(true);
		requestAnimationFrame(() => textareaRef.current?.focus());
	}, []);

	const renderPopoverTrigger = useCallback(
		(props: React.HTMLAttributes<HTMLSpanElement>) => (
			<span
				{...props}
				aria-hidden
				tabIndex={-1}
				className="pointer-events-none absolute inset-x-2 bottom-2 h-0"
			/>
		),
		[],
	);

	return (
		<div
			data-color={color}
			data-selected={selected}
			className="sticky-note group/sticky relative flex h-full w-full flex-col overflow-hidden border font-sans transition-shadow duration-200 ease-out motion-reduce:transition-none"
			style={ROOT_STYLE}
			onDoubleClick={(event: ReactMouseEvent) => {
				event.stopPropagation();
				enterEditMode();
			}}
		>
			<Handle
				type="source"
				position={Position.Right}
				isConnectable={false}
				style={LINK_HANDLE_STYLE}
			/>

			<NodeResizer
				isVisible={selected}
				minWidth={STICKY_NOTE_MIN_WIDTH}
				minHeight={nodeHeight}
				maxHeight={nodeHeight}
				lineClassName="!border-current/40"
				handleClassName="!size-2 !border !border-current/50 !bg-background"
			/>

			<Header kind={isEditing ? "EDITING" : "NOTE"} />

			<div className="relative flex flex-col">
				{isEditing ? (
					<textarea
						ref={textareaRef}
						value={text}
						onChange={linker.handleChangeText}
						onKeyDown={handleTextareaKey}
						onFocus={() => setIsEditing(true)}
						onBlur={() => {
							if (!linker.open) setIsEditing(false);
						}}
						onPointerDown={stopPropagation}
						placeholder={PLACEHOLDER_TEXT}
						spellCheck={false}
						style={{ height: textareaBoxH }}
						className="sticky-note__textarea nodrag nowheel m-2 block w-auto resize-none overflow-hidden border border-dashed bg-white/50 px-2 pt-2 pb-1 font-sans text-[13px] leading-5 outline-none placeholder:text-current/40"
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
				{/*
				 * Zero-height strip with pointer-events-none: clicks on the
				 * textarea never reach base-ui's trigger. Popover opens
				 * explicitly from the `#` / `.` caret handlers.
				 */}
				<Popover open={linker.open} onOpenChange={linker.setOpen}>
					<PopoverTrigger render={renderPopoverTrigger} />
					{linker.open && (
						<LinkerPopoverContent
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
						active={color}
						onPick={handleChangeColor}
						onStopPropagation={stopPropagation}
					/>
				)
			)}
		</div>
	);
}

export const StickyNoteNode = memo(StickyNoteNodeComponent);
