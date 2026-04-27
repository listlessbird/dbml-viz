import { act } from "react";
import type { ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Toolbar } from "@/components/Toolbar";
import { useAgentActivityStore } from "@/store/useAgentActivityStore";

interface RenderToolbarOptions {
	shareId?: string | null;
	isDirty?: boolean;
	sessionStatus?: ComponentProps<typeof Toolbar>["sessionStatus"];
	sessionId?: string | null;
	onConnectAgent?: () => void;
	onShowSession?: () => void;
}

interface RenderToolbarResult {
	root: Root;
	container: HTMLDivElement;
}

const renderToolbar = ({
	shareId = null,
	isDirty = false,
	sessionStatus = "offline",
	sessionId = null,
	onConnectAgent = vi.fn(),
	onShowSession = vi.fn(),
}: RenderToolbarOptions = {}): RenderToolbarResult => {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);

	act(() => {
		root.render(
			<Toolbar
				tableCount={2}
				relationCount={3}
				isSharing={false}
				shareId={shareId}
				isDirty={isDirty}
				sessionStatus={sessionStatus}
				sessionId={sessionId}
				onShare={vi.fn()}
				onConnectAgent={onConnectAgent}
				onShowSession={onShowSession}
			/>,
		);
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
	useAgentActivityStore.getState().reset();
});

describe("Toolbar share status", () => {
	it("shows explicit local save status before a share link exists", () => {
		const rendered = renderToolbar();
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		expect(rendered.container.textContent).toContain("Auto-saved locally");
		expect(rendered.container.textContent).not.toContain("Shared snapshot");
	});

	it("shows explicit shared snapshot and local edit status", () => {
		const rendered = renderToolbar({ shareId: "abc123", isDirty: true });
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		expect(rendered.container.textContent).toContain("Shared snapshot");
		expect(rendered.container.textContent).toContain("Copy link");
		expect(rendered.container.textContent).toContain("Local edits not shared");
		expect(rendered.container.textContent).toContain("abc123");
	});

	it("copies the share link from the explicit toolbar action", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});

		const rendered = renderToolbar({ shareId: "abc123" });
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		const copyButton = Array.from(rendered.container.querySelectorAll("button")).find(
			(button) => button.textContent?.includes("Copy link"),
		);

		expect(copyButton).toBeInstanceOf(HTMLButtonElement);

		await act(async () => {
			(copyButton as HTMLButtonElement).click();
			await Promise.resolve();
		});

		expect(writeText).toHaveBeenCalledWith(
			new URL("/s/abc123", window.location.origin).toString(),
		);
		expect(copyButton?.textContent).toContain("Copied");
	});
});

describe("Toolbar session pill", () => {
	it("renders the offline connect pill and triggers the connect handler", () => {
		const onConnectAgent = vi.fn();
		const rendered = renderToolbar({ onConnectAgent });
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		expect(rendered.container.textContent).toContain("Connect canvas");

		const pill = rendered.container.querySelector<HTMLButtonElement>(
			'[data-status="offline"]',
		);
		expect(pill).toBeInstanceOf(HTMLButtonElement);

		act(() => {
			pill?.click();
		});

		expect(onConnectAgent).toHaveBeenCalledTimes(1);
	});

	it("renders the connecting pill and re-opens the session modal when clicked", () => {
		const onShowSession = vi.fn();
		const rendered = renderToolbar({ sessionStatus: "connecting", onShowSession });
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		expect(rendered.container.textContent).toContain("Connecting");

		const pill = rendered.container.querySelector<HTMLButtonElement>(
			'[data-status="connecting"]',
		);
		act(() => {
			pill?.click();
		});

		expect(onShowSession).toHaveBeenCalledTimes(1);
	});

	it("renders the live pill with session id hint", () => {
		const rendered = renderToolbar({
			sessionStatus: "live",
			sessionId: "sess_xyz",
		});
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		expect(rendered.container.textContent).toContain("Live");
		expect(rendered.container.textContent).toContain("1 agent");
	});

	it("renders the reconnecting pill with attempt count", () => {
		useAgentActivityStore.getState().setReconnect({
			attempt: 3,
			nextDelayMs: 4000,
			maxAttempts: 5,
		});
		const rendered = renderToolbar({ sessionStatus: "reconnecting" });
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		expect(rendered.container.textContent).toContain("Reconnecting");
		expect(rendered.container.textContent).toContain("attempt 3");
	});
});
