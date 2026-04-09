import { Parser } from "@dbml/core";
import { describe, expect, it } from "vitest";

import {
	buildParsedSchemaFromDatabase,
	parseDbmlSource,
} from "@/lib/dbml-schema";
import { SAMPLE_SCHEMA_SOURCE } from "@/lib/sample-dbml";
import { parseSchemaSource } from "@/lib/schema-source-parser";
import { getColumnConstraintBadges } from "@/lib/table-constraints";

describe("buildParsedSchemaFromDatabase", () => {
	it("preserves composite keys, indexes, and foreign keys from SQL", () => {
		const parsed = buildParsedSchemaFromDatabase(
			Parser.parse(
				`
					CREATE TABLE parent (
						tenant_id int NOT NULL,
						id int NOT NULL,
						code varchar(32) UNIQUE NOT NULL,
						PRIMARY KEY (tenant_id, id),
						CONSTRAINT uniq_parent_tenant_code UNIQUE (tenant_id, code)
					);

					CREATE INDEX idx_parent_code_lookup ON parent (code);

					CREATE TABLE child (
						tenant_id int NOT NULL,
						parent_id int NOT NULL,
						CONSTRAINT fk_child_parent
							FOREIGN KEY (tenant_id, parent_id)
							REFERENCES parent (tenant_id, id)
							ON DELETE CASCADE
					);
				`,
				"postgres",
			),
		);

		const parent = parsed.tables.find((table) => table.id === "parent");
		const child = parsed.tables.find((table) => table.id === "child");
		const [ref] = parsed.refs;

		expect(parent?.indexes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "primary",
					columns: ["tenant_id", "id"],
				}),
				expect.objectContaining({
					kind: "unique",
					columns: ["code"],
				}),
				expect.objectContaining({
					kind: "unique",
					name: "uniq_parent_tenant_code",
					columns: ["tenant_id", "code"],
				}),
				expect.objectContaining({
					kind: "index",
					name: "idx_parent_code_lookup",
					columns: ["code"],
				}),
			]),
		);
		expect(parent?.columns.find((column) => column.name === "tenant_id")?.pk).toBe(true);
		expect(parent?.columns.find((column) => column.name === "id")?.pk).toBe(true);
		expect(parent?.columns.find((column) => column.name === "code")?.unique).toBe(true);
		expect(parent?.columns.find((column) => column.name === "code")?.isIndexed).toBe(true);
		expect(child?.columns.find((column) => column.name === "tenant_id")?.isForeignKey).toBe(
			true,
		);
		expect(child?.columns.find((column) => column.name === "parent_id")?.isForeignKey).toBe(
			true,
		);
		expect(ref).toEqual(
			expect.objectContaining({
				name: "fk_child_parent",
				onDelete: "cascade",
				from: {
					table: "child",
					columns: ["tenant_id", "parent_id"],
				},
				to: {
					table: "parent",
					columns: ["tenant_id", "id"],
				},
			}),
		);
	});
});

describe("parseDbmlSource", () => {
	it("maps DBML composite indexes into column flags and table constraints", () => {
		const parsed = parseDbmlSource(`
			Table memberships {
			  tenant_id int [not null]
			  user_id int [not null]
			  role varchar [not null]

			  indexes {
			    (tenant_id, user_id) [pk]
			    (tenant_id, role) [unique, name: "uniq_memberships_role"]
			  }
			}
		`);
		const [memberships] = parsed.tables;

		expect(memberships?.indexes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "primary",
					columns: ["tenant_id", "user_id"],
				}),
				expect.objectContaining({
					kind: "unique",
					name: "uniq_memberships_role",
					columns: ["tenant_id", "role"],
				}),
			]),
		);
		expect(memberships?.columns.find((column) => column.name === "tenant_id")?.pk).toBe(true);
		expect(memberships?.columns.find((column) => column.name === "user_id")?.pk).toBe(true);
		expect(memberships?.columns.find((column) => column.name === "role")?.unique).toBe(false);
		expect(memberships?.columns.find((column) => column.name === "role")?.isIndexed).toBe(
			true,
		);
	});

	it("ships a sample schema that exercises composite constraints and relations", () => {
		const { parsed, metadata } = parseSchemaSource(SAMPLE_SCHEMA_SOURCE);
		const invoices = parsed.tables.find((table) => table.id === "invoices");
		const memberships = parsed.tables.find((table) => table.id === "memberships");
		const membershipBadges = memberships ? getColumnConstraintBadges(memberships) : undefined;
		const invoiceForOrder = parsed.refs.find((ref) => ref.name === "invoice_for_order");
		const orderLinesToOrders = parsed.refs.find((ref) => ref.name === "fk_order_lines_order");

		expect(parsed.errors).toEqual([]);
		expect(metadata).toEqual({
			format: "sql",
			dialect: "mysql",
		});
		expect(parsed.tables.length).toBeGreaterThanOrEqual(12);
		expect(memberships?.indexes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "primary",
					columns: ["tenant_id", "user_id"],
				}),
				expect.objectContaining({
					kind: "unique",
					name: "uq_memberships_handle",
					columns: ["tenant_id", "handle"],
				}),
				expect.objectContaining({
					kind: "unique",
					name: "uq_memberships_seat_label",
					columns: ["tenant_id", "seat_label"],
				}),
			]),
		);
		expect(invoices?.indexes).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					kind: "unique",
					name: "uq_invoices_order",
					columns: ["tenant_id", "order_number"],
				}),
			]),
		);
		expect(membershipBadges?.get("tenant_id")).toHaveLength(2);
		expect(invoiceForOrder).toEqual(
			expect.objectContaining({
				onDelete: "restrict",
				from: {
					table: "invoices",
					columns: ["tenant_id", "order_number"],
				},
				to: {
					table: "orders",
					columns: ["tenant_id", "order_number"],
				},
			}),
		);
		expect(orderLinesToOrders).toEqual(
			expect.objectContaining({
				onDelete: "cascade",
				from: {
					table: "order_lines",
					columns: ["tenant_id", "order_number"],
				},
				to: {
					table: "orders",
					columns: ["tenant_id", "order_number"],
				},
			}),
		);
	});
});
