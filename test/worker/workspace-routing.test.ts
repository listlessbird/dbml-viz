import { describe, expect, it, vi } from "vitest";

import {
	matchWorkspaceAgentRoute,
	routeWorkspaceAgentRequest,
} from "../../src/worker/workspace/workspace-routing";

describe("Workspace Agent Routing", () => {
	it("matches workspace agent URLs", () => {
		const request = new Request(
			"https://example.com/api/agent/schema-workspace/workspace-1/mcp",
		);

		expect(matchWorkspaceAgentRoute(request)).toEqual({
			workspaceId: "workspace-1",
		});
	});

	it("ignores non-workspace agent URLs", () => {
		const request = new Request("https://example.com/api/parse");

		expect(matchWorkspaceAgentRoute(request)).toBeNull();
	});

	it("bootstraps the named workspace agent before forwarding", async () => {
		const request = new Request(
			"https://example.com/api/agent/schema-workspace/workspace-1/ws",
		);
		const response = new Response("ok");
		const fetch = vi.fn(() => response);
		const getByName = vi.fn(() => ({ fetch }));
		const namespace = {};

		const routed = await routeWorkspaceAgentRequest(
			request,
			{ SchemaWorkspace: namespace } as Env,
			{ getByName },
		);

		expect(routed).toBe(response);
		expect(getByName).toHaveBeenCalledWith(namespace, "workspace-1");
		expect(fetch).toHaveBeenCalledWith(request);
	});
});
