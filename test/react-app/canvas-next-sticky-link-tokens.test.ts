import { describe, expect, it } from "vitest";

import {
	parseLinksFromText,
	splitTextWithTokens,
} from "@/canvas-next/sticky-note/link-tokens";

const isAnyValid = () => true;

describe("Sticky Note link tokens", () => {
	it("extracts unique #table and #table.column refs in source order", () => {
		const text = "see #users and #orders.id and #users again";
		const refs = parseLinksFromText(text, isAnyValid);
		expect(refs).toEqual([
			{ token: "#users", table: "users" },
			{ token: "#orders.id", table: "orders", column: "id" },
		]);
	});

	it("drops refs the validator rejects", () => {
		const refs = parseLinksFromText("#known and #unknown", (table) =>
			table === "known",
		);
		expect(refs).toEqual([{ token: "#known", table: "known" }]);
	});

	it("splits text into alternating text and token segments", () => {
		const segments = splitTextWithTokens("see #users now", isAnyValid);
		expect(segments).toEqual([
			{ kind: "text", value: "see " },
			{ kind: "token", value: "#users", table: "users" },
			{ kind: "text", value: " now" },
		]);
	});

	it("renders rejected tokens as plain text segments", () => {
		const segments = splitTextWithTokens("#bad", (table) => table === "good");
		expect(segments).toEqual([{ kind: "text", value: "#bad" }]);
	});
});
