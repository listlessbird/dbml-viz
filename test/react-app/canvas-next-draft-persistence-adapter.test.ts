import { afterEach, describe, expect, it } from "vitest";

import { createDefaultDraftPersistenceAdapter } from "@/canvas-next/diagram-persistence-adapter";
import { useDiagramDraftStore } from "@/store/useDiagramDraftStore";
import type { SchemaPayload } from "@/types";

const samplePayload: SchemaPayload = {
	source: "Table users { id int }",
	positions: { users: { x: 10, y: 20 } },
	notes: [],
	version: 3,
};

afterEach(() => {
	useDiagramDraftStore.setState({ drafts: {} });
});

describe("createDefaultDraftPersistenceAdapter", () => {
	it("round-trips a Schema Payload through the underlying draft store", () => {
		const adapter = createDefaultDraftPersistenceAdapter();

		expect(adapter.getDraft(null)).toBeNull();

		adapter.setDraft(null, samplePayload);
		expect(adapter.getDraft(null)).toEqual(samplePayload);

		adapter.clearDraft(null);
		expect(adapter.getDraft(null)).toBeNull();
	});

	it("keeps drafts for different share ids isolated", () => {
		const adapter = createDefaultDraftPersistenceAdapter();
		const sharedPayload: SchemaPayload = {
			...samplePayload,
			source: "Table shared { id int }",
		};

		adapter.setDraft(null, samplePayload);
		adapter.setDraft("share-1", sharedPayload);

		expect(adapter.getDraft(null)).toEqual(samplePayload);
		expect(adapter.getDraft("share-1")).toEqual(sharedPayload);

		adapter.clearDraft(null);
		expect(adapter.getDraft(null)).toBeNull();
		expect(adapter.getDraft("share-1")).toEqual(sharedPayload);
	});
});
