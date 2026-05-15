import { describe, expect, it } from "vitest";

import {
	matchWorkspaceAgentRoute,
	routeWorkspaceAgentRequest,
} from "../../src/worker/workspace/workspace-routing";

describe("Workspace Agent Routing", () => {
	it("matches workspace agent URLs", () => {
		const request = new Request(
			"https://dbml-viz.com/api/agent/schema-workspace/workspace-1/mcp",
		);

		expect(matchWorkspaceAgentRoute(request)).toEqual({
			workspaceId: "workspace-1",
		});
	});

	it("ignores non-workspace agent URLs", () => {
		const request = new Request("https://dbml-viz.com/api/parse");

		expect(matchWorkspaceAgentRoute(request)).toBeNull();
	});

	it("does not route non-workspace requests", async () => {
		const routed = await routeWorkspaceAgentRequest(
			new Request("https://dbml-viz.com/api/parse"),
			{} as Env,
			{
				getByName: async () => {
					throw new Error("should not look up an agent for unrelated routes");
				},
			},
		);

		expect(routed).toBeNull();
	});
});
