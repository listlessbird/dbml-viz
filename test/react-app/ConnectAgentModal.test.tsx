import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ConnectAgentModal } from "@/components/agent-connectivity/ConnectAgentModal";

interface RenderModalOptions {
	readonly open?: boolean;
	readonly pairingUrl?: string | null;
	readonly status?: "offline" | "connecting" | "live" | "reconnecting" | "ended";
	readonly onDisconnect?: () => void;
}

const MCP_URL = "https://dbml.example/api/session/sess_123/mcp";

const renderModal = ({
	open = true,
	pairingUrl = MCP_URL,
	status = "live",
	onDisconnect = vi.fn(),
}: RenderModalOptions = {}) => {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);

	act(() => {
		root.render(
			<ConnectAgentModal
				open={open}
				status={status}
				pairingUrl={pairingUrl}
				onOpenChange={vi.fn()}
				onDisconnect={onDisconnect}
			/>,
		);
	});

	return { root, container };
};

let activeRoot: Root | null = null;

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
	}
	document.body.innerHTML = "";
	activeRoot = null;
	vi.useRealTimers();
});

describe("ConnectAgentModal", () => {
	it("renders nothing while closed", () => {
		const rendered = renderModal({ open: false });
		activeRoot = rendered.root;

		expect(document.body.textContent).not.toContain("Connect canvas to your agent");
	});

	it("renders the pairing endpoint, lead copy, and default Claude Code snippet", () => {
		const rendered = renderModal();
		activeRoot = rendered.root;

		expect(document.body.textContent).toContain("Connect canvas to your agent");
		expect(document.body.textContent).toContain("MCP endpoint");
		expect(document.body.textContent).toContain(MCP_URL);
		expect(document.body.textContent).toContain("dbml-canvas");
	});

	it("switches between client snippets via tabs", () => {
		const rendered = renderModal();
		activeRoot = rendered.root;

		const codexTab = Array.from(document.body.querySelectorAll("button")).find(
			(button) => button.textContent === "Codex",
		);
		expect(codexTab).toBeInstanceOf(HTMLButtonElement);

		act(() => {
			(codexTab as HTMLButtonElement).click();
		});

		expect(document.body.textContent).toContain("codex mcp add dbml-canvas");
	});

	it("copies the endpoint when the endpoint copy button is clicked", async () => {
		vi.useFakeTimers();
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});

		const rendered = renderModal();
		activeRoot = rendered.root;

		const buttons = Array.from(document.body.querySelectorAll("button")).filter(
			(button) => button.textContent?.includes("Copy"),
		);
		expect(buttons.length).toBeGreaterThan(0);

		await act(async () => {
			buttons[0]?.click();
			await Promise.resolve();
		});

		expect(writeText).toHaveBeenCalled();
	});

	it("invokes the disconnect handler", () => {
		const onDisconnect = vi.fn();
		const rendered = renderModal({ onDisconnect });
		activeRoot = rendered.root;

		const disconnectButton = Array.from(document.body.querySelectorAll("button")).find(
			(button) => button.textContent === "Disconnect",
		);
		expect(disconnectButton).toBeInstanceOf(HTMLButtonElement);

		act(() => {
			(disconnectButton as HTMLButtonElement).click();
		});

		expect(onDisconnect).toHaveBeenCalledTimes(1);
	});

	it("disables the disconnect button while offline", () => {
		const rendered = renderModal({ status: "offline" });
		activeRoot = rendered.root;

		const disconnectButton = Array.from(document.body.querySelectorAll("button")).find(
			(button) => button.textContent === "Disconnect",
		);
		expect((disconnectButton as HTMLButtonElement).disabled).toBe(true);
	});
});
