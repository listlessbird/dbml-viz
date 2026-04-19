import { IconTrash } from "@tabler/icons-react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import { memo, useCallback, useEffect, useRef, type ChangeEvent } from "react";

import { useStickyNotesStore } from "@/store/useStickyNotesStore";
import { cn } from "@/lib/utils";
import { STICKY_NOTE_COLORS, type StickyNoteColor, type StickyNoteNode as StickyNoteNodeType } from "@/types";

const COLOR_STYLES: Record<StickyNoteColor, string> = {
	yellow: "bg-[#fef3a5] border-[#e4d064] text-[#4a3d00]",
	pink: "bg-[#fcd0d9] border-[#e8a4b3] text-[#5a1a28]",
	blue: "bg-[#cde7ff] border-[#95bde0] text-[#13314d]",
	green: "bg-[#cfeccc] border-[#8cbd87] text-[#14361b]",
};

const SWATCH_STYLES: Record<StickyNoteColor, string> = {
	yellow: "bg-[#fbe36b]",
	pink: "bg-[#f4a9b8]",
	blue: "bg-[#8fc1f0]",
	green: "bg-[#9cd097]",
};

export const STICKY_NOTE_DRAG_HANDLE = "sticky-note-drag-handle";
export const STICKY_NOTE_MIN_WIDTH = 160;
export const STICKY_NOTE_MIN_HEIGHT = 140;

function StickyNoteNodeComponent({ id, selected }: NodeProps<StickyNoteNodeType>) {
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const text = useStickyNotesStore((state) => state.texts[id] ?? "");
	const color = useStickyNotesStore(
		(state) => state.notesById[id]?.color ?? "yellow",
	);

	useEffect(() => {
		if (text.length === 0 && textareaRef.current) {
			textareaRef.current.focus();
		}
		// Only run on mount for this note
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

	const handleChangeText = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) => {
			useStickyNotesStore.getState().updateText(id, event.target.value);
		},
		[id],
	);

	const stopPropagation = useCallback((event: { stopPropagation: () => void }) => {
		event.stopPropagation();
	}, []);

	return (
		<div
			data-selected={selected}
			className={cn(
				"sticky-note-root group/sticky relative flex h-full w-full flex-col border shadow-[0_12px_28px_color-mix(in_oklab,var(--foreground)_16%,transparent)] transition-shadow duration-200 ease-out motion-reduce:transition-none",
				"data-[selected=true]:shadow-[0_18px_36px_color-mix(in_oklab,var(--foreground)_22%,transparent)]",
				COLOR_STYLES[color],
			)}
			style={{
				minWidth: STICKY_NOTE_MIN_WIDTH,
				minHeight: STICKY_NOTE_MIN_HEIGHT,
				animation: "sticky-note-in 180ms cubic-bezier(0.215, 0.61, 0.355, 1) both",
			}}
		>
			<NodeResizer
				isVisible={selected}
				minWidth={STICKY_NOTE_MIN_WIDTH}
				minHeight={STICKY_NOTE_MIN_HEIGHT}
				lineClassName="!border-current/40"
				handleClassName="!size-2 !border !border-current/50 !bg-background"
			/>

			<div
				className={cn(
					STICKY_NOTE_DRAG_HANDLE,
					"flex cursor-grab items-center justify-between gap-2 border-b border-current/15 px-2 py-1.5 active:cursor-grabbing",
				)}
			>
				<div className="flex items-center gap-1">
					{STICKY_NOTE_COLORS.map((swatchColor) => (
						<button
							key={swatchColor}
							type="button"
							title={swatchColor}
							aria-label={`Change color to ${swatchColor}`}
							data-active={color === swatchColor}
							onPointerDown={stopPropagation}
							onClick={(event) => {
								event.stopPropagation();
								handleChangeColor(swatchColor);
							}}
							className={cn(
								"size-3 rounded-full border border-black/15 transition-transform duration-150 ease-out hover:scale-110 data-[active=true]:ring-1 data-[active=true]:ring-current data-[active=true]:ring-offset-1 data-[active=true]:ring-offset-transparent motion-reduce:transition-none",
								SWATCH_STYLES[swatchColor],
							)}
						/>
					))}
				</div>
				<button
					type="button"
					aria-label="Delete sticky note"
					title="Delete"
					onPointerDown={stopPropagation}
					onClick={(event) => {
						event.stopPropagation();
						handleDelete();
					}}
					className="flex size-5 items-center justify-center text-current/60 opacity-0 transition-opacity duration-150 ease hover:text-current group-hover/sticky:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none"
				>
					<IconTrash className="size-3.5" />
				</button>
			</div>

			<textarea
				ref={textareaRef}
				value={text}
				onChange={handleChangeText}
				onPointerDown={stopPropagation}
				placeholder="Write a note…"
				className="sticky-note-textarea nodrag nowheel flex-1 resize-none overflow-hidden bg-transparent px-3 py-2 text-sm leading-6 outline-none placeholder:text-current/40"
			/>
		</div>
	);
}

export const StickyNoteNode = memo(StickyNoteNodeComponent);
