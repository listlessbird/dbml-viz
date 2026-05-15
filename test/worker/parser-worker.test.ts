import { describe, expect, it } from "vitest";

import parserWorker from "../../src/parser-worker";

const parse = (source: string, id = 1) =>
	parserWorker.fetch(
		new Request("https://parser.test/api/parse", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ id, source }),
		}),
	);

describe("Parser Worker HTTP contract", () => {
	it("returns parsed schema and source ranges for valid DBML", async () => {
		const response = await parse("Table users {\n  id int [pk]\n}", 101);

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			id: 101,
			ok: true,
			metadata: { format: "dbml" },
			parsed: {
				tables: [{ id: "users", name: "users" }],
				refs: [],
				errors: [],
			},
			sourceRanges: {
				tablesById: {
					users: expect.any(Object),
				},
			},
		});
	});

	it("rejects malformed parse request bodies", async () => {
		const response = await parserWorker.fetch(
			new Request("https://parser.test/api/parse", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ source: "Table users {}" }),
			}),
		);

		expect(response.status).toBe(400);
		await response.text();
	});
});
