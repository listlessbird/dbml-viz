import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDraftPersistence } from "@/hooks/useDraftPersistence";
import type { DiagramRouteState } from "@/lib/draftPersistence";
import type { DiagramNode, SchemaPayload } from "@/types";
import type { WorkspaceStatus } from "@/types/workspace";

const SOURCE = "Table edited_root_copy {\n  id integer [pk]\n}";

interface HarnessProps {
	readonly workspaceStatus: WorkspaceStatus;
	readonly setDraft: (shareId: string | null, payload: SchemaPayload) => void;
}

function DraftPersistenceHarness({ workspaceStatus, setDraft }: HarnessProps) {
	const route: DiagramRouteState = { shareId: null, isDirty: false };

	useDraftPersistence({
		source: SOURCE,
		nodes: [] as DiagramNode[],
		canPersistNodePositions: false,
		shareSeedPositions: {},
		isLoadingShare: false,
		workspaceStatus,
		viewedRoute: route,
		currentShareBaseline: null,
		rootSampleBaseline: null,
		clearDraft: vi.fn(),
		setDraft,
		replaceViewedRoute: vi.fn(),
	});

	return null;
}

const renderHarness = (props: HarnessProps) => {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);

	act(() => {
		root.render(<DraftPersistenceHarness {...props} />);
	});

	return { root, container };
};

let activeRoot: Root | null = null;
let activeContainer: HTMLDivElement | null = null;

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
	}

	activeContainer?.remove();
	activeRoot = null;
	activeContainer = null;
	vi.useRealTimers();
});

describe("useDraftPersistence workspace behavior", () => {
	it("persists drafts while offline", () => {
		vi.useFakeTimers();
		const setDraft = vi.fn();

		const rendered = renderHarness({ workspaceStatus: "offline", setDraft });
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		act(() => {
			vi.advanceTimersByTime(180);
		});

		expect(setDraft).toHaveBeenCalledWith(null, {
			source: SOURCE,
			positions: {},
			notes: [],
			version: 3,
		});
	});

	it("persists drafts while workspace is live so MCP-pushed changes survive refresh", () => {
		vi.useFakeTimers();
		const setDraft = vi.fn();

		const rendered = renderHarness({ workspaceStatus: "live", setDraft });
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		act(() => {
			vi.advanceTimersByTime(180);
		});

		expect(setDraft).toHaveBeenCalledWith(null, {
			source: SOURCE,
			positions: {},
			notes: [],
			version: 3,
		});
	});

	it("skips draft writes while workspace is reconnecting", () => {
		vi.useFakeTimers();
		const setDraft = vi.fn();

		const rendered = renderHarness({ workspaceStatus: "reconnecting", setDraft });
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		act(() => {
			vi.advanceTimersByTime(1_000);
		});

		expect(setDraft).not.toHaveBeenCalled();
	});
});
