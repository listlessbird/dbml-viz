import { useLayoutEffect, useMemo } from "react";

import type {
	LinkValidator,
	StickyNoteLinkRef,
} from "@/canvas-next/sticky-note/link-tokens";
import {
	BODY_LINE_HEIGHT,
	BODY_PAD_BOTTOM,
	BODY_PAD_TOP,
	BODY_PAD_X,
	CHIP_LINE_HEIGHT,
	EDITBAR_H,
	HEADER_H,
	LINKS_ROW_GAP_Y,
	LINKS_ROW_PAD_BOTTOM,
	LINKS_ROW_PAD_TOP,
	PALETTE_H,
	ROOT_BORDER,
	STICKY_NOTE_AUTO_FIT_SLACK,
	STICKY_NOTE_MIN_BODY_WIDTH,
	STICKY_NOTE_MIN_HEIGHT,
	STICKY_NOTE_MIN_WIDTH,
	TA_BORDER,
	TA_MARGIN,
	TA_PAD_BOTTOM,
	TA_PAD_TOP,
	TA_PAD_X,
	measureLinksStats,
	measureProseStats,
	measureTextareaLines,
} from "@/canvas-next/sticky-note/measure";
import { useDiagramSession } from "@/diagram-session/diagram-session-context";

export type StickyWidthMode = "auto" | "manual";

export interface StickyLayoutInput {
	readonly id: string;
	readonly text: string;
	readonly isEditing: boolean;
	readonly selected: boolean;
	readonly widthMode: StickyWidthMode;
	readonly currentWidth: number;
	readonly currentHeight: number;
	readonly links: readonly StickyNoteLinkRef[];
	readonly isValidRef: LinkValidator;
}

export interface StickyLayoutOutput {
	readonly textareaBoxH: number;
	readonly nodeHeight: number;
	readonly nodeWidth: number;
}

const fitBodyWidth = (
	currentWidth: number,
	text: string,
	links: readonly StickyNoteLinkRef[],
	isValidRef: LinkValidator,
): number => {
	const baseline = Math.max(
		STICKY_NOTE_MIN_BODY_WIDTH,
		currentWidth - 2 * ROOT_BORDER - 2 * BODY_PAD_X,
	);
	let resolved = baseline;
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
};

export function useStickyLayout({
	id,
	text,
	isEditing,
	selected,
	widthMode,
	currentWidth,
	currentHeight,
	links,
	isValidRef,
}: StickyLayoutInput): StickyLayoutOutput {
	const updateStickyNote = useDiagramSession((state) => state.updateStickyNote);

	const resolveBodyWidth = useMemo(() => {
		if (isEditing || widthMode === "manual") {
			return Math.max(
				STICKY_NOTE_MIN_BODY_WIDTH,
				currentWidth - 2 * ROOT_BORDER - 2 * BODY_PAD_X,
			);
		}
		return fitBodyWidth(currentWidth, text, links, isValidRef);
	}, [currentWidth, isEditing, isValidRef, links, text, widthMode]);

	const nodeWidth =
		isEditing || widthMode === "manual"
			? currentWidth
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

	const proseStats = useMemo(
		() => measureProseStats(text, bodyWidth, isValidRef),
		[text, bodyWidth, isValidRef],
	);
	const proseBlockH =
		proseStats.lineCount * BODY_LINE_HEIGHT + BODY_PAD_TOP + BODY_PAD_BOTTOM;

	const textareaBoxH = useMemo(() => {
		const lines = measureTextareaLines(text, textareaInnerWidth);
		return (
			lines * BODY_LINE_HEIGHT + TA_PAD_TOP + TA_PAD_BOTTOM + 2 * TA_BORDER
		);
	}, [text, textareaInnerWidth]);

	const linksStats = useMemo(
		() => measureLinksStats(links, bodyWidth),
		[links, bodyWidth],
	);
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

	const editNodeHeight = useMemo(
		() =>
			Math.max(
				STICKY_NOTE_MIN_HEIGHT,
				Math.ceil(
					HEADER_H +
						EDITBAR_H +
						textareaBoxH +
						2 * TA_MARGIN +
						2 * ROOT_BORDER,
				),
			),
		[textareaBoxH],
	);

	const displayNodeHeight = useMemo(
		() =>
			Math.max(
				STICKY_NOTE_MIN_HEIGHT,
				Math.ceil(
					HEADER_H +
						(selected ? PALETTE_H : 0) +
						proseBlockH +
						linksBlockH +
						2 * ROOT_BORDER,
				),
			),
		[selected, proseBlockH, linksBlockH],
	);

	const nodeHeight = isEditing
		? Math.max(editNodeHeight, displayNodeHeight)
		: displayNodeHeight;

	const finalNodeWidth = Math.max(STICKY_NOTE_MIN_WIDTH, Math.ceil(nodeWidth));

	useLayoutEffect(() => {
		if (widthMode !== "auto") {
			if (nodeHeight <= currentHeight) return;
			updateStickyNote(id, {
				height: nodeHeight,
			});
			return;
		}
		updateStickyNote(id, {
			width: finalNodeWidth,
			height: nodeHeight,
		});
	}, [
		currentHeight,
		finalNodeWidth,
		id,
		nodeHeight,
		updateStickyNote,
		widthMode,
	]);

	return { textareaBoxH, nodeHeight, nodeWidth: finalNodeWidth };
}
