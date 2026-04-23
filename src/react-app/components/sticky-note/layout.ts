import { layout, prepare } from "@chenglou/pretext";
import {
	measureRichInlineStats,
	prepareRichInline,
	type RichInlineItem,
} from "@chenglou/pretext/rich-inline";

import {
	splitTextWithTokens,
	type LinkValidator,
	type StickyNoteLinkRef,
} from "./linkHelpers";

export interface StickyTextMeasure {
	readonly lineCount: number;
	readonly maxLineWidth: number;
}

// Pretext needs a canvas-shorthand font string that matches the CSS. The
// app's `font-sans` resolves to Noto Sans Variable (see index.css); keep
// the lineHeight numbers synced to the `leading-5` Tailwind class.
export const BODY_FONT = '13px "Noto Sans Variable", sans-serif';
export const CHIP_FONT = '10px "Noto Sans Variable", sans-serif';
export const BODY_LINE_HEIGHT = 20;
export const CHIP_LINE_HEIGHT = 20;

// Chrome heights are hardcoded to their CSS box totals so per-keystroke
// size math never touches the DOM. Update if padding / content sizes
// change in StickyNoteChrome.tsx.
export const ROOT_BORDER = 1;
export const HEADER_H = 27; // py-1.5 (12) + border (1) + content (~14)
export const EDITBAR_H = 35; // py-1.5 (12) + border (1) + size-5.5 (22)
export const PALETTE_H = 27; // py-1.5 (12) + border (1) + size-3.5 (14)
export const LINKS_ROW_GAP_Y = 4;
export const LINKS_ROW_PAD_TOP = 8;
export const LINKS_ROW_PAD_BOTTOM = 8;
export const BODY_PAD_X = 12;
// Asymmetric vertical padding: full leading above the first line, half
// leading below the last. Mirrors the demo's LAST_LINE_BLOCK_HEIGHT
// trick — we keep CSS-flow layout, just trim the wasted half-leading
// via smaller bottom padding so the math and DOM match.
export const BODY_PAD_TOP = 8;
export const BODY_PAD_BOTTOM = 4;
export const TA_MARGIN = 8;
export const TA_BORDER = 1;
export const TA_PAD_X = 8;
export const TA_PAD_TOP = 8;
export const TA_PAD_BOTTOM = 4;
export const STICKY_NOTE_AUTO_FIT_SLACK = 16;

// Pill/chip chrome in px: border + inner padding + arrow gap.
const TOKEN_EXTRA_W = 12;
const CHIP_EXTRA_W = 26;

export const STICKY_NOTE_MIN_WIDTH = 220;
export const STICKY_NOTE_MIN_HEIGHT = 160;
export const STICKY_NOTE_MIN_BODY_WIDTH =
	STICKY_NOTE_MIN_WIDTH - 2 * ROOT_BORDER - 2 * BODY_PAD_X;

export const PLACEHOLDER_TEXT = "Write a note… type # to link a table";
const placeholderPrepared = prepare(PLACEHOLDER_TEXT, BODY_FONT, {
	whiteSpace: "pre-wrap",
});

// Rich-inline is white-space: normal only, so pre-wrap semantics are
// emulated by splitting on hard newlines and summing per-block line
// counts. Token pills contribute their pill chrome via extraWidth.
export function measureProseStats(
	text: string,
	bodyWidth: number,
	isValidRef: LinkValidator,
): StickyTextMeasure {
	if (text.length === 0) {
		return {
			lineCount: layout(placeholderPrepared, bodyWidth, BODY_LINE_HEIGHT)
				.lineCount,
			maxLineWidth: 0,
		};
	}
	let total = 0;
	let maxLineWidth = 0;
	for (const block of text.split("\n")) {
		if (block.length === 0) {
			total += 1;
			continue;
		}
		const segs = splitTextWithTokens(block, isValidRef);
		const items: RichInlineItem[] = segs.map((s) =>
			s.kind === "token"
				? {
						text: s.value,
						font: BODY_FONT,
						break: "never",
						extraWidth: TOKEN_EXTRA_W,
					}
				: { text: s.value, font: BODY_FONT },
		);
		if (items.length === 0) {
			total += 1;
			continue;
		}
		const prepared = prepareRichInline(items);
		const stats = measureRichInlineStats(prepared, bodyWidth);
		total += stats.lineCount;
		maxLineWidth = Math.max(maxLineWidth, stats.maxLineWidth);
	}
	return {
		lineCount: Math.max(1, total),
		maxLineWidth,
	};
}

export function measureTextareaLines(text: string, innerWidth: number): number {
	const prepared =
		text.length === 0
			? placeholderPrepared
			: prepare(text, BODY_FONT, { whiteSpace: "pre-wrap" });
	return Math.max(
		1,
		layout(prepared, innerWidth, BODY_LINE_HEIGHT).lineCount,
	);
}

export function measureLinksStats(
	links: readonly StickyNoteLinkRef[],
	bodyWidth: number,
): StickyTextMeasure {
	if (links.length === 0) return { lineCount: 0, maxLineWidth: 0 };
	const items: RichInlineItem[] = links.map((ref) => ({
		text: ref.column ? `${ref.table}.${ref.column}` : ref.table,
		font: CHIP_FONT,
		break: "never",
		extraWidth: CHIP_EXTRA_W,
	}));
	const prepared = prepareRichInline(items);
	return measureRichInlineStats(prepared, bodyWidth);
}
