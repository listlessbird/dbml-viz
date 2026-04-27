import { describe, expect, it } from "vitest";

import { decideWorkspaceAttach } from "../../src/worker/durable-objects/workspace-attach";
import type { WorkspaceSeed, WorkspaceState } from "../../src/worker/durable-objects/workspace-types";

const browserSeed: WorkspaceSeed = {
	source: "Table browser {}",
	positions: {},
	notes: [],
	baseline: null,
};

const remoteWorkspace: WorkspaceState = {
	source: "Table remote {}",
	positions: {},
	notes: [],
	diagnostics: [],
	parsedTableCount: 1,
	parsedRefCount: 0,
	baseline: null,
	createdAt: 100,
	updatedAt: 200,
	lastActivityAt: 200,
};

describe("workspace attach negotiation", () => {
	it("accepts browser state for an empty workspace", () => {
		expect(
			decideWorkspaceAttach(null, {
				state: browserSeed,
				updatedAt: 150,
			}),
		).toEqual({
			winner: "browser",
			state: browserSeed,
			updatedAt: 150,
		});
	});

	it("keeps remote state when it is newer than the browser attach", () => {
		expect(
			decideWorkspaceAttach(remoteWorkspace, {
				state: browserSeed,
				updatedAt: 150,
			}),
		).toEqual({
			winner: "remote",
			workspace: remoteWorkspace,
		});
	});

	it("accepts browser state when it is at least as new as remote state", () => {
		expect(
			decideWorkspaceAttach(remoteWorkspace, {
				state: browserSeed,
				updatedAt: 200,
			}),
		).toEqual({
			winner: "browser",
			state: browserSeed,
			updatedAt: 200,
		});
	});
});
