import { layout, prepare } from "@chenglou/pretext";
import {
	measureRichInlineStats,
	prepareRichInline,
	type RichInlineItem,
} from "@chenglou/pretext/rich-inline";

import {
	parseLinksFromText,
	splitTextWithTokens,
	type LinkValidator,
	type StickyNoteLinkRef,
} from "@/canvas-next/sticky-note/link-tokens";
import type { ParsedSchema, SharedStickyNote, StickyNoteLayout } from "@/types";

interface StickyTextMeasure {
	readonly lineCount: number;
	readonly maxLineWidth: number;
}

const BODY_FONT = '13px "Noto Sans Variable", sans-serif';
const CHIP_FONT = '10px "Noto Sans Variable", sans-serif';
export const BODY_LINE_HEIGHT = 20;
export const CHIP_LINE_HEIGHT = 20;

export const ROOT_BORDER = 1;
export const HEADER_H = 27;
export const EDITBAR_H = 35;
export const PALETTE_H = 27;
export const LINKS_ROW_GAP_Y = 4;
export const LINKS_ROW_PAD_TOP = 8;
export const LINKS_ROW_PAD_BOTTOM = 8;
export const BODY_PAD_X = 12;
export const BODY_PAD_TOP = 8;
export const BODY_PAD_BOTTOM = 4;
export const TA_MARGIN = 8;
export const TA_BORDER = 1;
export const TA_PAD_X = 8;
export const TA_PAD_TOP = 8;
export const TA_PAD_BOTTOM = 4;
export const STICKY_NOTE_AUTO_FIT_SLACK = 16;
// Textarea wrapping is a little more eager than Pretext's paragraph model.
// Keep the virtual width conservative so edit mode grows before native scroll.
const TEXTAREA_WRAP_GUARD = 12;

const TOKEN_EXTRA_W = 12;
const CHIP_EXTRA_W = 26;

export const STICKY_NOTE_MIN_WIDTH = 220;
export const STICKY_NOTE_MIN_HEIGHT = 160;
export const STICKY_NOTE_MIN_BODY_WIDTH =
	STICKY_NOTE_MIN_WIDTH - 2 * ROOT_BORDER - 2 * BODY_PAD_X;

const CHEAP_STICKY_NOTE_LAYOUT: StickyNoteLayout = Object.freeze({
	width: STICKY_NOTE_MIN_WIDTH,
	height: STICKY_NOTE_MIN_HEIGHT,
});

export const getCheapStickyNoteLayout = (): StickyNoteLayout =>
	CHEAP_STICKY_NOTE_LAYOUT;

const buildLinkValidator = (parsedSchema: ParsedSchema): LinkValidator => {
	const columnNamesByTable = new Map<string, Set<string>>();
	for (const table of parsedSchema.tables) {
		columnNamesByTable.set(
			table.name,
			new Set(table.columns.map((column) => column.name)),
		);
	}
	return (table, column) => {
		const columns = columnNamesByTable.get(table);
		if (!columns) return false;
		if (column === undefined) return true;
		return columns.has(column);
	};
};

const computeStickyNoteDisplayLayout = (
	text: string,
	isValidRef: LinkValidator,
): StickyNoteLayout => {
	const links = parseLinksFromText(text, isValidRef);

	let bodyWidth = STICKY_NOTE_MIN_BODY_WIDTH;
	for (let pass = 0; pass < 3; pass += 1) {
		const proseStats = measureProseStats(text, bodyWidth, isValidRef);
		const linksStats = measureLinksStats(links, bodyWidth);
		const usedWidth = Math.max(
			proseStats.maxLineWidth,
			linksStats.maxLineWidth,
		);
		const next = Math.max(
			STICKY_NOTE_MIN_BODY_WIDTH,
			Math.ceil(usedWidth + STICKY_NOTE_AUTO_FIT_SLACK),
		);
		if (next === bodyWidth) break;
		bodyWidth = next;
	}

	const proseStats = measureProseStats(text, bodyWidth, isValidRef);
	const linksStats = measureLinksStats(links, bodyWidth);

	const proseBlockH =
		proseStats.lineCount * BODY_LINE_HEIGHT + BODY_PAD_TOP + BODY_PAD_BOTTOM;
	const linksBlockH =
		linksStats.lineCount === 0
			? 0
			: linksStats.lineCount * CHIP_LINE_HEIGHT +
				(linksStats.lineCount - 1) * LINKS_ROW_GAP_Y +
				LINKS_ROW_PAD_TOP +
				LINKS_ROW_PAD_BOTTOM;

	const nodeWidth = Math.max(
		STICKY_NOTE_MIN_WIDTH,
		Math.ceil(bodyWidth + 2 * ROOT_BORDER + 2 * BODY_PAD_X),
	);
	const nodeHeight = Math.max(
		STICKY_NOTE_MIN_HEIGHT,
		Math.ceil(HEADER_H + proseBlockH + linksBlockH + 2 * ROOT_BORDER),
	);
	return { width: nodeWidth, height: nodeHeight };
};

export const createAccurateStickyNoteLayoutGetter = (
	parsedSchema: ParsedSchema,
): ((note: SharedStickyNote) => StickyNoteLayout) => {
	const isValidRef = buildLinkValidator(parsedSchema);
	return (note) => computeStickyNoteDisplayLayout(note.text, isValidRef);
};

export const createAccurateStickyNoteLayoutCache = (
	parsedSchema: ParsedSchema,
): ((note: SharedStickyNote) => StickyNoteLayout) => {
	const getter = createAccurateStickyNoteLayoutGetter(parsedSchema);
	const cache = new Map<string, StickyNoteLayout>();
	return (note) => {
		const cached = cache.get(note.id);
		if (cached) return cached;
		const layout = getter(note);
		cache.set(note.id, layout);
		return layout;
	};
};

export const PLACEHOLDER_TEXT = "Write a note… type # to link a table";
const placeholderPrepared = prepare(PLACEHOLDER_TEXT, BODY_FONT, {
	whiteSpace: "pre-wrap",
});

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
	const measuredWidth =
		text.length === 0
			? innerWidth
			: Math.max(0, innerWidth - TEXTAREA_WRAP_GUARD);
	return Math.max(
		1,
		layout(prepared, measuredWidth, BODY_LINE_HEIGHT).lineCount,
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
