import { describe, expect, it } from "vitest";

import { findSourceFocusPosition } from "@/schema-source-editor/source-focus-locator";

describe("findSourceFocusPosition", () => {
	it("locates a DBML table header", () => {
		const doc = "Table users {\n  id int [pk]\n}\n\nTable orders {\n  id int\n}";
		const pos = findSourceFocusPosition(doc, {
			tableName: "orders",
			columnName: null,
		});
		expect(pos).not.toBeNull();
		expect(doc.slice(pos!, pos! + 12)).toBe("Table orders");
	});

	it("locates a SQL CREATE TABLE header", () => {
		const doc =
			"CREATE TABLE tenants (\n  id BIGINT\n);\n\nCREATE TABLE IF NOT EXISTS orders (\n  id BIGINT\n);";
		const pos = findSourceFocusPosition(doc, {
			tableName: "orders",
			columnName: null,
		});
		expect(pos).not.toBeNull();
		expect(
			doc.slice(pos!, pos! + "CREATE TABLE IF NOT EXISTS orders".length),
		).toBe("CREATE TABLE IF NOT EXISTS orders");
	});

	it("locates a column inside the table block", () => {
		const doc = "Table users {\n  id int\n  email varchar\n}";
		const pos = findSourceFocusPosition(doc, {
			tableName: "users",
			columnName: "email",
		});
		expect(pos).not.toBeNull();
		expect(doc.slice(pos!, pos! + 5)).toBe("email");
	});

	it("returns null when the table cannot be found", () => {
		expect(
			findSourceFocusPosition("Table users {}", {
				tableName: "missing",
				columnName: null,
			}),
		).toBeNull();
	});

	it("falls back to the table header when the column is missing", () => {
		const doc = "Table users {\n  id int\n}";
		const pos = findSourceFocusPosition(doc, {
			tableName: "users",
			columnName: "ghost",
		});
		expect(pos).not.toBeNull();
		expect(doc.slice(pos!, pos! + 11)).toBe("Table users");
	});

	it("targets the correct table when a schema-qualified name disambiguates same-named tables", () => {
		const doc =
			"Table public.users {\n  id int\n}\n\nTable audit.users {\n  id int\n}";

		const publicPos = findSourceFocusPosition(doc, {
			tableName: "public.users",
			columnName: null,
		});
		const auditPos = findSourceFocusPosition(doc, {
			tableName: "audit.users",
			columnName: null,
		});

		expect(publicPos).not.toBeNull();
		expect(auditPos).not.toBeNull();
		expect(auditPos!).toBeGreaterThan(publicPos!);
		expect(doc.slice(auditPos!, auditPos! + "Table audit.users".length)).toBe(
			"Table audit.users",
		);
	});
});
