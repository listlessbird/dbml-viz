import { describe, expect, it } from "vitest";

import { parseSchemaPayload } from "@/lib/schema-payload";

describe("schema-payload", () => {
	it("accepts the current schema payload shape", () => {
		expect(
			parseSchemaPayload({
				source: "Table users {}",
				positions: {
					users: { x: 80, y: 120 },
				},
				version: 2,
			}),
		).toEqual({
			source: "Table users {}",
			positions: {
				users: { x: 80, y: 120 },
			},
			version: 2,
		});
	});

	it("rejects legacy and malformed payloads from untyped sources", () => {
		expect(parseSchemaPayload(null)).toBeNull();
		expect(
			parseSchemaPayload({
				dbml: "Table users {}",
				positions: {},
				version: 1,
			}),
		).toBeNull();
		expect(
			parseSchemaPayload({
				source: "Table users {}",
				positions: {
					users: { x: "80", y: 120 },
				},
				version: 2,
			}),
		).toBeNull();
	});
});
