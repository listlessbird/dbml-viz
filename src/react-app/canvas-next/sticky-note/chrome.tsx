import { IconTrash } from "@tabler/icons-react";
import { memo } from "react";

import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";
import { STICKY_NOTE_COLORS, type StickyNoteColor } from "@/types";

const STICKY_NOTE_DRAG_HANDLE_CLASS = "sticky-note-drag-handle";

const DRAG_DOT_KEYS = ["a", "b", "c", "d", "e", "f"] as const;

type StopEvent = { stopPropagation: () => void };

export const Header = memo(function Header({
	kind,
}: {
	readonly kind: "NOTE" | "EDITING";
}) {
	return (
		<div
			data-testid="sticky-note-drag-handle"
			className={cn(
				STICKY_NOTE_DRAG_HANDLE_CLASS,
				"flex cursor-grab items-center gap-2 border-b border-(--sn-divider) bg-(--sn-header) px-2.5 py-1.5 active:cursor-grabbing",
			)}
		>
			<NoteIcon />
			<span className="text-[9px] font-bold tracking-[0.18em] text-(--sn-muted-ink) uppercase">
				{kind}
			</span>
			<DragDots />
		</div>
	);
});

function NoteIcon() {
	return (
		<span
			aria-hidden
			className="relative inline-block size-[var(--dimension-sticky-icon)] shrink-0 rounded-swatch border border-(--sn-muted-ink) bg-(--sn-surface)"
		>
			<span className="absolute -right-px -bottom-px size-[var(--dimension-sticky-fold)] border-t border-l border-(--sn-muted-ink) bg-(--sn-header)" />
		</span>
	);
}

function DragDots() {
	return (
		<span
			aria-hidden
			className="ml-auto inline-flex items-center gap-0.75 text-(--sn-muted-ink)"
		>
			{DRAG_DOT_KEYS.map((key) => (
				<i key={key} className="size-[var(--dimension-sticky-swatch-dot)] rounded-full bg-current" />
			))}
		</span>
	);
}

export const EditBar = memo(function EditBar({
	onDelete,
}: {
	readonly onDelete: () => void;
}) {
	return (
		<div className="mt-auto flex items-center gap-1.5 border-t border-(--sn-divider) bg-sticky-note-chip px-2.5 py-1.5 text-(--sn-muted-ink)">
			<button
				type="button"
				aria-label="Delete sticky note"
				title="Delete"
				data-testid="sticky-note-delete"
				onPointerDown={(event) => {
					event.stopPropagation();
					event.preventDefault();
					onDelete();
				}}
				onClick={(event) => {
					event.stopPropagation();
					onDelete();
				}}
				className="inline-flex size-[var(--dimension-sticky-action)] items-center justify-center rounded-chip border border-transparent transition-colors duration-fast hover:border-sticky-note-danger-border hover:bg-sticky-note-danger-hover hover:text-sticky-note-danger motion-reduce:transition-none"
			>
				<IconTrash className="size-3" />
			</button>
			<KbdGroup className="ml-auto font-mono text-[10px]">
				<Kbd className="border border-(--sn-dashed) bg-sticky-note-chip">#</Kbd>
				<span>link</span>
				<span aria-hidden>·</span>
				<Kbd className="border border-(--sn-dashed) bg-sticky-note-chip">Esc</Kbd>
				<span>done</span>
			</KbdGroup>
		</div>
	);
});

export const PaletteStrip = memo(function PaletteStrip({
	active,
	onPick,
	onStopPropagation,
}: {
	readonly active: StickyNoteColor;
	readonly onPick: (color: StickyNoteColor) => void;
	readonly onStopPropagation: (event: StopEvent) => void;
}) {
	return (
		<div className="mt-auto flex items-center gap-1.5 border-t border-(--sn-divider) bg-sticky-note-chip px-2.5 py-1.5">
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
						data-testid={`sticky-note-swatch-${swatchColor}`}
						onPointerDown={onStopPropagation}
						onClick={(event) => {
							event.stopPropagation();
							onPick(swatchColor);
						}}
						className="sticky-swatch size-[var(--dimension-sticky-swatch)] rounded-swatch border border-foreground/15 transition-transform duration-fast hover:scale-110 data-[active=true]:border-sticky-note-focus-ring data-[active=true]:shadow-sticky-swatch-active motion-reduce:transition-none"
					/>
				);
			})}
		</div>
	);
});
