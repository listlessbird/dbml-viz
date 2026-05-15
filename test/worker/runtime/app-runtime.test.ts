import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

const worker = exports.default;

const sharedPayload = {
	source: "Table users { id int [pk] }",
	positions: { users: { x: 80, y: 120 } },
	notes: [
		{
			id: "sticky-1",
			color: "yellow",
			text: "Keep #users.id stable.",
		},
	],
	version: 3,
};

const postJson = (url: string, body: unknown) =>
	worker.fetch(
		new Request(url, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}),
	);

describe("Worker runtime routes", () => {
	
	it("saves and loads shared schema payloads through KV", async () => {
		const saveResponse = await postJson(
			"https://dbml-viz.test/api/save",
			sharedPayload,
		);
		expect(saveResponse.status).toBe(201);
		const { id } = (await saveResponse.json()) as { id: string };
		expect(id).toEqual(expect.any(String));

		const loadResponse = await worker.fetch(
			`https://dbml-viz.test/api/load/${id}`,
		);
		expect(loadResponse.status).toBe(200);
		expect(await loadResponse.json()).toEqual(sharedPayload);
	});

	it("rejects malformed shared schema payloads before writing to KV", async () => {
		const response = await postJson("https://dbml-viz.test/api/save", {
			source: "",
			positions: {},
			notes: [],
			version: 3,
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toEqual({
			error: "Request body must match the shared schema payload.",
		});
	});

	it("returns not found for missing shared schema ids", async () => {
		const response = await worker.fetch(
			"https://dbml-viz.test/api/load/missing-share",
		);

		expect(response.status).toBe(404);
		expect(await response.json()).toEqual({
			error: 'Shared schema "missing-share" was not found.',
		});
	});

	it("returns an operational error when stored shared schema payload is invalid", async () => {
		await env.SCHEMAS.put("broken-share", JSON.stringify({ version: 3 }));

		const response = await worker.fetch(
			"https://dbml-viz.test/api/load/broken-share",
		);

		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			error: "Unable to access the shared schema store.",
		});
	});

	it("forwards parse requests to the parser service binding", async () => {
		const response = await postJson("https://dbml-viz.test/api/parse", {
			id: 77,
			source: "Table users { id int [pk] }",
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toMatchObject({
			id: 77,
			ok: true,
			metadata: { format: "dbml" },
			parsed: {
				tables: [{ id: "users", name: "users" }],
			},
		});
	});

	it("returns parser diagnostics from the parser service binding", async () => {
		const response = await postJson("https://dbml-viz.test/api/parse", {
			id: 78,
			source: "syntax error",
		});

		expect(response.status).toBe(400);
		expect(await response.json()).toMatchObject({
			id: 78,
			ok: false,
			diagnostics: [{ message: "Expected table body" }],
		});
	});
});
