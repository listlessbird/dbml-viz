import { IconTrash } from "@tabler/icons-react";

import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import { STICKY_NOTE_COLORS, type StickyNoteColor } from "@/types";

export const STICKY_NOTE_DRAG_HANDLE = "sticky-note-drag-handle";

const DRAG_DOT_KEYS = ["a", "b", "c", "d", "e", "f"] as const;

type StopEvent = { stopPropagation: () => void };

export function Header({ kind }: { readonly kind: "NOTE" | "EDITING" }) {
	return (
		<div
			className={cn(
				STICKY_NOTE_DRAG_HANDLE,
				"sticky-note__header flex cursor-grab items-center gap-2 border-b px-2.5 py-1.5 active:cursor-grabbing",
			)}
		>
			<NoteIcon />
			<span className="sticky-note__kind text-[9px] font-bold tracking-[0.18em] uppercase">
				{kind}
			</span>
			<DragDots />
		</div>
	);
}

function NoteIcon() {
	return (
		<span
			aria-hidden
			className="sticky-note__icon relative inline-block size-3 shrink-0 rounded-xs border"
		>
			<span className="sticky-note__icon-fold absolute -right-px -bottom-px size-1 border-t border-l" />
		</span>
	);
}

function DragDots() {
	return (
		<span
			aria-hidden
			className="sticky-note__drag-dots ml-auto inline-flex items-center gap-0.75"
		>
			{DRAG_DOT_KEYS.map((key) => (
				<i key={key} className="sticky-note__drag-dot size-0.5 rounded-full" />
			))}
		</span>
	);
}

export function EditBar({
	onDelete,
}: {
	readonly onDelete: () => void;
}) {
	return (
		<div className="sticky-note__editbar mt-auto flex items-center gap-1.5 border-t px-2.5 py-1.5">
			<button
				type="button"
				aria-label="Delete sticky note"
				title="Delete"
				// pointerdown fires before the textarea's blur can unmount this
				// bar; preventDefault keeps focus in the textarea and suppresses
				// the synthetic click for mouse, so onClick only catches keyboard.
				onPointerDown={(event) => {
					event.stopPropagation();
					event.preventDefault();
					onDelete();
				}}
				onClick={(event) => {
					event.stopPropagation();
					onDelete();
				}}
				className="sticky-note__delete inline-flex size-5.5 items-center justify-center rounded-[3px] border border-transparent transition-colors hover:border-red-300 hover:bg-red-100 hover:text-red-600 motion-reduce:transition-none"
			>
				<IconTrash className="size-3" />
			</button>
			<KbdGroup className="ml-auto font-mono text-[10px]">
				<Kbd className="sticky-note__kbd border bg-white/60">#</Kbd>
				<span>link</span>
				<span aria-hidden>·</span>
				<Kbd className="sticky-note__kbd border bg-white/60">Esc</Kbd>
				<span>done</span>
			</KbdGroup>
		</div>
	);
}

export function PaletteStrip({
	active,
	onPick,
	onStopPropagation,
}: {
	readonly active: StickyNoteColor;
	readonly onPick: (color: StickyNoteColor) => void;
	readonly onStopPropagation: (event: StopEvent) => void;
}) {
	return (
		<div className="sticky-note__palette mt-auto flex items-center gap-1.5 border-t bg-black/2 px-2.5 py-1.5">
			{STICKY_NOTE_COLORS.map((swatchColor) => {
				const isOn = swatchColor === active;
				return (
					<button
						key={swatchColor}
						type="button"
						title={swatchColor}
						aria-label={`Change color to ${swatchColor}`}
						data-active={isOn}
						data-swatch={swatchColor}
						onPointerDown={onStopPropagation}
						onClick={(event) => {
							event.stopPropagation();
							onPick(swatchColor);
						}}
						className="sticky-note__swatch sticky-swatch size-3.5 rounded-xs border border-black/15 transition-transform duration-150 hover:scale-110 motion-reduce:transition-none"
					/>
				);
			})}
		</div>
	);
}
