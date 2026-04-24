import { act } from "react";
import type { ComponentProps } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Toolbar } from "@/components/Toolbar";

interface RenderToolbarOptions {
	shareId?: string | null;
	isDirty?: boolean;
	sessionStatus?: ComponentProps<typeof Toolbar>["sessionStatus"];
	agentEditorLocked?: boolean;
	onConnectAgent?: () => void;
	onDisconnectAgent?: () => void;
	onUnlockEditor?: () => void;
}

interface RenderToolbarResult {
	root: Root;
	container: HTMLDivElement;
}

const renderToolbar = ({
	shareId = null,
	isDirty = false,
	sessionStatus = "offline",
	agentEditorLocked = false,
	onConnectAgent = vi.fn(),
	onDisconnectAgent = vi.fn(),
	onUnlockEditor = vi.fn(),
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
				agentEditorLocked={agentEditorLocked}
				onShare={vi.fn()}
				onConnectAgent={onConnectAgent}
				onDisconnectAgent={onDisconnectAgent}
				onUnlockEditor={onUnlockEditor}
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

	it("shows connect action while offline and calls the connect handler", () => {
		const onConnectAgent = vi.fn();
		const rendered = renderToolbar({ onConnectAgent });
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		const connectButton = Array.from(rendered.container.querySelectorAll("button")).find(
			(button) => button.textContent?.includes("Connect Canvas"),
		);

		expect(connectButton).toBeInstanceOf(HTMLButtonElement);

		act(() => {
			(connectButton as HTMLButtonElement).click();
		});

		expect(onConnectAgent).toHaveBeenCalledTimes(1);
	});

	it("shows live session controls and editor unlock action", () => {
		const onDisconnectAgent = vi.fn();
		const onUnlockEditor = vi.fn();
		const rendered = renderToolbar({
			sessionStatus: "live",
			agentEditorLocked: true,
			onDisconnectAgent,
			onUnlockEditor,
		});
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		expect(rendered.container.textContent).toContain("Agent session live");
		expect(rendered.container.textContent).toContain("Unlock editor");

		const buttons = Array.from(rendered.container.querySelectorAll("button"));
		const disconnectButton = buttons.find((button) =>
			button.textContent?.includes("Disconnect"),
		);
		const unlockButton = buttons.find((button) =>
			button.textContent?.includes("Unlock editor"),
		);

		act(() => {
			(disconnectButton as HTMLButtonElement).click();
			(unlockButton as HTMLButtonElement).click();
		});

		expect(onDisconnectAgent).toHaveBeenCalledTimes(1);
		expect(onUnlockEditor).toHaveBeenCalledTimes(1);
	});
});
