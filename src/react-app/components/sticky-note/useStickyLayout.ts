import { clearCache } from "@chenglou/pretext";
import { useReactFlow } from "@xyflow/react";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";

import type {
	CanvasNode,
	StickyNoteNode as StickyNoteNodeType,
} from "@/types";

import type { LinkValidator, StickyNoteLinkRef } from "./linkHelpers";
import {
	BODY_LINE_HEIGHT,
	BODY_PAD_BOTTOM,
	BODY_PAD_TOP,
	BODY_PAD_X,
	CHIP_LINE_HEIGHT,
	EDITBAR_H,
	HEADER_H,
	LINKS_ROW_PAD_BOTTOM,
	PALETTE_H,
	ROOT_BORDER,
	STICKY_NOTE_MIN_HEIGHT,
	STICKY_NOTE_MIN_WIDTH,
	TA_BORDER,
	TA_MARGIN,
	TA_PAD_BOTTOM,
	TA_PAD_TOP,
	TA_PAD_X,
	measureLinksLineCount,
	measureProseLineCount,
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
	const { id, text, width, isEditing, selected, links, isValidRef } = input;
	const fontsReady = useFontsReady();
	const { setNodes } = useReactFlow<CanvasNode>();

	const nodeWidth = width ?? STICKY_NOTE_MIN_WIDTH;
	const bodyWidth = Math.max(0, nodeWidth - 2 * ROOT_BORDER - 2 * BODY_PAD_X);
	const textareaInnerWidth = Math.max(
		0,
		nodeWidth -
			2 * ROOT_BORDER -
			2 * TA_MARGIN -
			2 * TA_BORDER -
			2 * TA_PAD_X,
	);

	const proseBlockH = useMemo(() => {
		void fontsReady;
		const lines = measureProseLineCount(text, bodyWidth, isValidRef);
		return lines * BODY_LINE_HEIGHT + BODY_PAD_TOP + BODY_PAD_BOTTOM;
	}, [text, bodyWidth, isValidRef, fontsReady]);

	const textareaBoxH = useMemo(() => {
		void fontsReady;
		const lines = measureTextareaLines(text, textareaInnerWidth);
		return (
			lines * BODY_LINE_HEIGHT + TA_PAD_TOP + TA_PAD_BOTTOM + 2 * TA_BORDER
		);
	}, [text, textareaInnerWidth, fontsReady]);

	const linksBlockH = useMemo(() => {
		void fontsReady;
		const lines = measureLinksLineCount(links, bodyWidth);
		return lines > 0 ? lines * CHIP_LINE_HEIGHT + LINKS_ROW_PAD_BOTTOM : 0;
	}, [links, bodyWidth, fontsReady]);

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

	// Bidirectional: height always tracks the Pretext-computed content
	// height. Width stays user-controlled; the NodeResizer locks its
	// vertical handle by receiving min==max==nodeHeight upstream.
	const nodeHeight = Math.ceil(desiredNodeH);
	useLayoutEffect(() => {
		setNodes((nodes: StickyNoteNodeType[] | CanvasNode[]) =>
			nodes.map((node) => {
				if (node.id !== id || node.type !== "sticky") return node;
				if (node.height === nodeHeight) return node;
				return { ...node, height: nodeHeight };
			}),
		);
	}, [nodeHeight, id, setNodes]);

	return { textareaBoxH, nodeHeight };
}
