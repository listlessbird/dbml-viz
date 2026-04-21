import { useMemo } from "react";

import {
	splitTextWithTokens,
	type LinkValidator,
	type StickyNoteLinkRef,
} from "./linkHelpers";
import { PLACEHOLDER_TEXT } from "./layout";

export function ProseBody({
	text,
	links,
	isValidRef,
	onClick,
	onChipClick,
}: {
	readonly text: string;
	readonly links: readonly StickyNoteLinkRef[];
	readonly isValidRef: LinkValidator;
	readonly onClick: () => void;
	readonly onChipClick: (ref: StickyNoteLinkRef) => void;
}) {
	const segments = useMemo(
		() => splitTextWithTokens(text, isValidRef),
		[text, isValidRef],
	);
	return (
		<div
			role="presentation"
			onClick={onClick}
			onPointerDown={(e) => e.stopPropagation()}
			className="sticky-note__body nodrag cursor-text px-3 pt-2 pb-1 font-sans text-[13px] leading-5 wrap-break-word whitespace-pre-wrap"
		>
			{text.length === 0 ? (
				<span className="italic opacity-50">{PLACEHOLDER_TEXT}</span>
			) : (
				segments.map((seg, idx) =>
					seg.kind === "token" ? (
						<button
							key={idx}
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								const ref = links.find((l) => l.token === seg.value);
								if (ref) onChipClick(ref);
							}}
							className="sticky-note__token mx-px rounded-xs border px-1 font-sans text-[13px] align-baseline"
						>
							{seg.value}
						</button>
					) : (
						<span key={idx}>{seg.value}</span>
					),
				)
			)}
		</div>
	);
}

export function LinksRow({
	links,
	onChipClick,
}: {
	readonly links: readonly StickyNoteLinkRef[];
	readonly onChipClick: (ref: StickyNoteLinkRef) => void;
}) {
	return (
		<div className="flex flex-wrap gap-x-1.5 gap-y-1 px-3 pb-1.5">
			{links.map((ref) => (
				<button
					key={ref.token}
					type="button"
					onClick={(e) => {
						e.stopPropagation();
						onChipClick(ref);
					}}
					onPointerDown={(e) => e.stopPropagation()}
					className="sticky-note__chip nodrag inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-0 font-sans text-[10px]"
				>
					<span aria-hidden className="sticky-note__chip-arrow">
						→
					</span>
					{ref.column ? `${ref.table}.${ref.column}` : ref.table}
				</button>
			))}
		</div>
	);
}
