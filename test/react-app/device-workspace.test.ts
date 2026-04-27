import { describe, expect, it, vi } from "vitest";

import { getOrCreateDeviceId } from "@/lib/device-workspace";
import { makeSessionMcpUrl, makeSessionWebSocketUrl } from "@/lib/session-url";

describe("device workspace identity", () => {
	it("creates and reuses a browser device id", () => {
		const randomUUID = vi
			.spyOn(crypto, "randomUUID")
			.mockReturnValue("123e4567-e89b-12d3-a456-426614174000");

		expect(getOrCreateDeviceId()).toBe("123e4567-e89b-12d3-a456-426614174000");
		expect(getOrCreateDeviceId()).toBe("123e4567-e89b-12d3-a456-426614174000");
		expect(randomUUID).toHaveBeenCalledTimes(1);
	});
});

describe("device workspace URLs", () => {
	it("builds stable agent workspace endpoints from a device id", () => {
		expect(makeSessionWebSocketUrl("123e4567-e89b-12d3-a456-426614174000")).toBe(
			"ws://localhost:3000/api/agent/123e4567-e89b-12d3-a456-426614174000/ws",
		);
		expect(makeSessionMcpUrl("123e4567-e89b-12d3-a456-426614174000")).toBe(
			"http://localhost:3000/api/agent/123e4567-e89b-12d3-a456-426614174000/mcp",
		);
	});
});
