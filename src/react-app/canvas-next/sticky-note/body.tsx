import { memo, useMemo } from "react";

import {
	splitTextWithTokens,
	type LinkValidator,
	type StickyNoteLinkRef,
} from "@/canvas-next/sticky-note/link-tokens";
import { PLACEHOLDER_TEXT } from "@/canvas-next/sticky-note/measure";

interface ProseBodyProps {
	readonly text: string;
	readonly links: readonly StickyNoteLinkRef[];
	readonly isValidRef: LinkValidator;
	readonly onClick: () => void;
	readonly onChipClick: (ref: StickyNoteLinkRef) => void;
}

export const ProseBody = memo(function ProseBody({
	text,
	links,
	isValidRef,
	onClick,
	onChipClick,
}: ProseBodyProps) {
	const segments = useMemo(
		() => splitTextWithTokens(text, isValidRef),
		[text, isValidRef],
	);
	const keyedSegments = useMemo(() => {
		const out: { key: string; segment: (typeof segments)[number] }[] = [];
		let cursor = 0;
		for (const segment of segments) {
			out.push({ key: `${segment.kind}:${cursor}`, segment });
			cursor = cursor + segment.value.length;
		}
		return out;
	}, [segments]);
	return (
		<div
			role="presentation"
			data-testid="sticky-note-prose"
			onClick={onClick}
			onPointerDown={(e) => e.stopPropagation()}
			className="min-w-0 cursor-text px-3 pt-2 pb-1 font-sans text-[13px] leading-5 text-(--sn-ink) whitespace-pre-wrap wrap-anywhere"
		>
			{text.length === 0 ? (
				<span className="italic opacity-50">{PLACEHOLDER_TEXT}</span>
			) : (
				keyedSegments.map(({ key, segment }) =>
					segment.kind === "token" ? (
						<button
							key={key}
							type="button"
							data-testid="sticky-note-token"
							onClick={(e) => {
								e.stopPropagation();
								const ref = links.find((l) => l.token === segment.value);
								if (ref) onChipClick(ref);
							}}
							className="mx-px max-w-full whitespace-normal break-all rounded-swatch border border-sticky-note-token-border bg-sticky-note-token px-1 text-left font-sans text-[13px] text-sticky-note-token-foreground align-baseline"
						>
							{segment.value}
						</button>
					) : (
						<span key={key}>{segment.value}</span>
					),
				)
			)}
		</div>
	);
});

interface LinksRowProps {
	readonly links: readonly StickyNoteLinkRef[];
	readonly onChipClick: (ref: StickyNoteLinkRef) => void;
}

export const LinksRow = memo(function LinksRow({
	links,
	onChipClick,
}: LinksRowProps) {
	return (
		<div
			data-testid="sticky-note-links-row"
			className="flex min-w-0 flex-wrap gap-x-1.5 gap-y-1 px-3 pt-2 pb-2"
		>
			{links.map((ref) => (
				<button
					key={ref.token}
					type="button"
					data-testid="sticky-note-chip"
					onClick={(e) => {
						e.stopPropagation();
						onChipClick(ref);
					}}
					onPointerDown={(e) => e.stopPropagation()}
					className="inline-flex max-w-full items-center gap-1 rounded-chip border border-(--sn-chip-border) bg-sticky-note-chip px-1.5 py-0 text-left font-sans text-[10px] text-(--sn-chip-ink)"
				>
					<span aria-hidden className="text-(--sn-muted-ink)">
						→
					</span>
					<span className="min-w-0 break-all">
						{ref.column ? `${ref.table}.${ref.column}` : ref.table}
					</span>
				</button>
			))}
		</div>
	);
});
