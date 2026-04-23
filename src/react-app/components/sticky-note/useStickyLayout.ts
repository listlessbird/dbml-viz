import { clearCache } from "@chenglou/pretext";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";

import {
	useStickyNotesStore,
	type StickyNoteWidthMode,
} from "@/store/useStickyNotesStore";

import type { LinkValidator, StickyNoteLinkRef } from "./linkHelpers";
import {
	BODY_LINE_HEIGHT,
	BODY_PAD_BOTTOM,
	BODY_PAD_TOP,
	BODY_PAD_X,
	CHIP_LINE_HEIGHT,
	EDITBAR_H,
	HEADER_H,
	LINKS_ROW_GAP_Y,
	LINKS_ROW_PAD_TOP,
	LINKS_ROW_PAD_BOTTOM,
	PALETTE_H,
	ROOT_BORDER,
	STICKY_NOTE_AUTO_FIT_SLACK,
	STICKY_NOTE_MIN_HEIGHT,
	STICKY_NOTE_MIN_BODY_WIDTH,
	STICKY_NOTE_MIN_WIDTH,
	TA_BORDER,
	TA_MARGIN,
	TA_PAD_BOTTOM,
	TA_PAD_TOP,
	TA_PAD_X,
	measureLinksStats,
	measureProseStats,
	measureTextareaLines,
} from "./layout";

// Canvas measurements fall back before the webfont is ready. Flip the
// flag once document.fonts reports loaded and clear Pretext's cache so
// downstream measurements re-run with correct metrics.
function useFontsReady(): boolean {
	const [ready, setReady] = useState(
		() =>
			typeof document !== "undefined" && document.fonts.status === "loaded",
	);
	useEffect(() => {
		if (ready || typeof document === "undefined") return;
		let alive = true;
		document.fonts.ready.then(() => {
			if (!alive) return;
			clearCache();
			setReady(true);
		});
		return () => {
			alive = false;
		};
	}, [ready]);
	return ready;
}

export interface StickyLayoutInput {
	readonly id: string;
	readonly text: string;
	readonly width: number | undefined;
	readonly widthMode: StickyNoteWidthMode;
	readonly isEditing: boolean;
	readonly selected: boolean;
	readonly links: readonly StickyNoteLinkRef[];
	readonly isValidRef: LinkValidator;
}

export interface StickyLayoutOutput {
	readonly textareaBoxH: number;
	readonly nodeHeight: number;
}

export function useStickyLayout(
	input: StickyLayoutInput,
): StickyLayoutOutput {
	const { id, text, width, widthMode, isEditing, selected, links, isValidRef } =
		input;
	const fontsReady = useFontsReady();
	const syncAutoLayout = useStickyNotesStore((state) => state.syncAutoLayout);

	const currentNodeWidth = width ?? STICKY_NOTE_MIN_WIDTH;
	const resolveBodyWidth = useMemo(() => {
		void fontsReady;
		if (isEditing || widthMode === "manual") {
			return Math.max(
				STICKY_NOTE_MIN_BODY_WIDTH,
				currentNodeWidth - 2 * ROOT_BORDER - 2 * BODY_PAD_X,
			);
		}

		let resolved = Math.max(
			STICKY_NOTE_MIN_BODY_WIDTH,
			currentNodeWidth - 2 * ROOT_BORDER - 2 * BODY_PAD_X,
		);

		for (let pass = 0; pass < 3; pass += 1) {
			const proseStats = measureProseStats(text, resolved, isValidRef);
			const linksStats = measureLinksStats(links, resolved);
			const usedWidth = Math.max(
				proseStats.maxLineWidth,
				linksStats.maxLineWidth,
			);
			const next = Math.max(
				STICKY_NOTE_MIN_BODY_WIDTH,
				Math.ceil(usedWidth + STICKY_NOTE_AUTO_FIT_SLACK),
			);
			if (next === resolved) break;
			resolved = next;
		}

		return resolved;
	}, [currentNodeWidth, fontsReady, isEditing, isValidRef, links, text, widthMode]);

	const nodeWidth =
		isEditing || widthMode === "manual"
			? currentNodeWidth
			: resolveBodyWidth + 2 * ROOT_BORDER + 2 * BODY_PAD_X;
	const bodyWidth = Math.max(0, nodeWidth - 2 * ROOT_BORDER - 2 * BODY_PAD_X);
	const textareaInnerWidth = Math.max(
		0,
		nodeWidth -
			2 * ROOT_BORDER -
			2 * TA_MARGIN -
			2 * TA_BORDER -
			2 * TA_PAD_X,
	);

	const proseStats = useMemo(() => {
		void fontsReady;
		return measureProseStats(text, bodyWidth, isValidRef);
	}, [text, bodyWidth, isValidRef, fontsReady]);
	const proseBlockH = useMemo(
		() =>
			proseStats.lineCount * BODY_LINE_HEIGHT + BODY_PAD_TOP + BODY_PAD_BOTTOM,
		[proseStats],
	);

	const textareaBoxH = useMemo(() => {
		void fontsReady;
		const lines = measureTextareaLines(text, textareaInnerWidth);
		return (
			lines * BODY_LINE_HEIGHT + TA_PAD_TOP + TA_PAD_BOTTOM + 2 * TA_BORDER
		);
	}, [text, textareaInnerWidth, fontsReady]);

	const linksStats = useMemo(() => {
		void fontsReady;
		return measureLinksStats(links, bodyWidth);
	}, [links, bodyWidth, fontsReady]);

	const linksBlockH = useMemo(() => {
		const lines = linksStats.lineCount;
		if (lines === 0) return 0;
		return (
			lines * CHIP_LINE_HEIGHT +
			(lines - 1) * LINKS_ROW_GAP_Y +
			LINKS_ROW_PAD_TOP +
			LINKS_ROW_PAD_BOTTOM
		);
	}, [linksStats]);

	const desiredNodeH = useMemo(() => {
		const chrome =
			HEADER_H + (isEditing ? EDITBAR_H : selected ? PALETTE_H : 0);
		const content = isEditing
			? textareaBoxH + 2 * TA_MARGIN
			: proseBlockH + linksBlockH;
		return Math.max(
			STICKY_NOTE_MIN_HEIGHT,
			chrome + content + 2 * ROOT_BORDER,
		);
	}, [isEditing, selected, textareaBoxH, proseBlockH, linksBlockH]);

	const nodeHeight = Math.ceil(desiredNodeH);
	useLayoutEffect(() => {
		syncAutoLayout(id, {
			width: Math.ceil(nodeWidth),
			height: nodeHeight,
		});
	}, [id, nodeHeight, nodeWidth, syncAutoLayout]);

	return { textareaBoxH, nodeHeight };
}
