import { describe, expect, it } from "vitest";

import { getTableMarkdown } from "@/lib/table-markdown";
import type { TableData } from "@/types";

const usersTable: TableData = {
	id: "users",
	name: "users",
	schema: "public",
	columns: [
		{
			name: "id",
			type: "bigint",
			pk: true,
			notNull: true,
			unique: false,
			isForeignKey: false,
			isIndexed: true,
		},
		{
			name: "email",
			type: "varchar(191)",
			pk: false,
			notNull: true,
			unique: true,
			isForeignKey: false,
			isIndexed: false,
			note: "Login identifier",
		},
	],
	indexes: [],
};

describe("getTableMarkdown", () => {
	it("renders a Markdown table with constraints and notes", () => {
		const md = getTableMarkdown(usersTable);
		expect(md).toContain("### public.users");
		expect(md).toContain("| Column | Type | Constraints | Note |");
		expect(md).toMatch(/\| id \| bigint \| PK, NOT NULL \|/);
		expect(md).toMatch(/\| email \| varchar\(191\) \| UNIQUE, NOT NULL \| Login identifier \|/);
	});

	it("escapes pipe characters in cell values", () => {
		const md = getTableMarkdown({
			...usersTable,
			schema: undefined,
			columns: [
				{
					name: "weird|col",
					type: "text",
					pk: false,
					notNull: false,
					unique: false,
					isForeignKey: false,
					isIndexed: false,
				},
			],
		});
		expect(md).toContain("| weird\\|col |");
	});
});
