import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useDraftPersistence } from "@/hooks/useDraftPersistence";
import type { DiagramRouteState } from "@/lib/draftPersistence";
import type { DiagramNode, SchemaPayload } from "@/types";
import type { SessionStatus } from "@/types/session";

const SOURCE = "Table edited_root_copy {\n  id integer [pk]\n}";

interface HarnessProps {
	readonly sessionStatus: SessionStatus;
	readonly setDraft: (shareId: string | null, payload: SchemaPayload) => void;
}

function DraftPersistenceHarness({ sessionStatus, setDraft }: HarnessProps) {
	const route: DiagramRouteState = { shareId: null, isDirty: false };

	useDraftPersistence({
		source: SOURCE,
		nodes: [] as DiagramNode[],
		canPersistNodePositions: false,
		shareSeedPositions: {},
		isLoadingShare: false,
		sessionStatus,
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

describe("useDraftPersistence session behavior", () => {
	it("persists drafts while offline", () => {
		vi.useFakeTimers();
		const setDraft = vi.fn();

		const rendered = renderHarness({ sessionStatus: "offline", setDraft });
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

	it.each(["live", "reconnecting"] as const)(
		"skips draft writes while session is %s",
		(sessionStatus) => {
			vi.useFakeTimers();
			const setDraft = vi.fn();

			const rendered = renderHarness({ sessionStatus, setDraft });
			activeRoot = rendered.root;
			activeContainer = rendered.container;

			act(() => {
				vi.advanceTimersByTime(1_000);
			});

			expect(setDraft).not.toHaveBeenCalled();
		},
	);
});
