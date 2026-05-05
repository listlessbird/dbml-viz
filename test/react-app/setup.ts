import { clearCache } from "@chenglou/pretext";
import { afterEach } from "vitest";

import { clearTableNodeLayoutCache } from "@/components/table-node/layout";
import { useDiagramDraftStore } from "@/store/useDiagramDraftStore";

const initialDraftStoreState = useDiagramDraftStore.getInitialState();

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
	.IS_REACT_ACT_ENVIRONMENT = true;

class MockCanvasRenderingContext2D {
	font = "16px sans-serif";

	measureText(text: string) {
		const match = /(\d+(?:\.\d+)?)px/.exec(this.font);
		const fontSize = match ? Number.parseFloat(match[1]!) : 16;
		const averageAdvance = fontSize * 0.56;
		return {
			width: Array.from(text).length * averageAdvance,
		};
	}
}

class MockOffscreenCanvas {
	constructor(
		readonly width: number,
		readonly height: number,
	) {}

	getContext(kind: string) {
		if (kind !== "2d") return null;
		return new MockCanvasRenderingContext2D();
	}
}

if (!("OffscreenCanvas" in globalThis)) {
	Object.assign(globalThis, {
		OffscreenCanvas: MockOffscreenCanvas,
	});
}

class MockResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
}

if (!("ResizeObserver" in globalThis)) {
	Object.assign(globalThis, {
		ResizeObserver: MockResizeObserver,
	});
}

afterEach(() => {
	window.localStorage.clear();
	clearCache();
	clearTableNodeLayoutCache();
	useDiagramDraftStore.setState(initialDraftStoreState, true);
});
