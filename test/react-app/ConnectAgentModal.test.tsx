import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConnectAgentModal } from "@/components/ConnectAgentModal";

interface RenderModalOptions {
	readonly open?: boolean;
	readonly pairingUrl?: string | null;
	readonly agentEditorLocked?: boolean;
	readonly onUnlockEditor?: () => void;
}

const MCP_URL = "https://dbml.example/api/session/sess_123/mcp";

const renderModal = ({
	open = true,
	pairingUrl = MCP_URL,
	agentEditorLocked = false,
	onUnlockEditor = vi.fn(),
}: RenderModalOptions = {}) => {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);

	act(() => {
		root.render(
			<ConnectAgentModal
				open={open}
				status="live"
				pairingUrl={pairingUrl}
				agentEditorLocked={agentEditorLocked}
				onOpenChange={vi.fn()}
				onDisconnect={vi.fn()}
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
	vi.useRealTimers();
});

describe("ConnectAgentModal", () => {
	it("renders nothing while closed", () => {
		const rendered = renderModal({ open: false });
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		expect(document.body.textContent).not.toContain("Connect an agent");
	});

	it("shows frictionless MCP setup snippets", () => {
		const rendered = renderModal();
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		expect(document.body.textContent).toContain(MCP_URL);
		expect(document.body.textContent).toContain("npx add-mcp");
		expect(document.body.textContent).toContain("codex mcp add dbml-canvas --url");
		expect(document.body.textContent).toContain("claude mcp add-json dbml-canvas");
		expect(document.body.textContent).toContain('"dbml-canvas"');
	});

	it("copies a snippet and resets the copied label", async () => {
		vi.useFakeTimers();
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});

		const rendered = renderModal();
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		const copyButton = Array.from(document.body.querySelectorAll("button")).find(
			(button) => button.textContent?.includes("Copy"),
		);

		expect(copyButton).toBeInstanceOf(HTMLButtonElement);

		await act(async () => {
			(copyButton as HTMLButtonElement).click();
			await Promise.resolve();
		});

		expect(writeText).toHaveBeenCalledWith(MCP_URL);
		expect(copyButton?.textContent).toContain("Copied");

		act(() => {
			vi.advanceTimersByTime(1600);
		});

		expect(copyButton?.textContent).toContain("Copy");
	});

	it("shows and invokes the editor unlock control", () => {
		const onUnlockEditor = vi.fn();
		const rendered = renderModal({ agentEditorLocked: true, onUnlockEditor });
		activeRoot = rendered.root;
		activeContainer = rendered.container;

		expect(document.body.textContent).toContain("Editor is locked");

		const unlockButton = Array.from(document.body.querySelectorAll("button")).find(
			(button) => button.textContent?.includes("Unlock editor"),
		);

		act(() => {
			(unlockButton as HTMLButtonElement).click();
		});

		expect(onUnlockEditor).toHaveBeenCalledTimes(1);
	});
});
