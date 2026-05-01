import { describe, expect, it } from "vitest";

import { buildCanvasProjection } from "@/canvas-next/canvas-projection";
import {
	createCanvasRuntimeStore,
	type ProjectionRuntimeState,
} from "@/canvas-next/canvas-runtime-store";
import type { Diagram } from "@/diagram-session/diagram-session-context";
import type { ParsedSchema, RefData, TableData } from "@/types";

const tableUsers: TableData = {
	id: "users",
	name: "users",
	columns: [
		{
			name: "id",
			type: "int",
			pk: true,
			notNull: true,
			unique: false,
			isForeignKey: false,
			isIndexed: true,
		},
	],
	indexes: [],
};

const tableOrders: TableData = {
	id: "orders",
	name: "orders",
	columns: [
		{
			name: "id",
			type: "int",
			pk: true,
			notNull: true,
			unique: false,
			isForeignKey: false,
			isIndexed: true,
		},
		{
			name: "user_id",
			type: "int",
			pk: false,
			notNull: true,
			unique: false,
			isForeignKey: true,
			isIndexed: false,
		},
	],
	indexes: [],
};

const tableProducts: TableData = {
	id: "products",
	name: "products",
	columns: [
		{
			name: "id",
			type: "int",
			pk: true,
			notNull: true,
			unique: false,
			isForeignKey: false,
			isIndexed: true,
		},
	],
	indexes: [],
};

const ordersToUsers: RefData = {
	id: "fk_orders_users:0",
	from: { table: "orders", columns: ["user_id"] },
	to: { table: "users", columns: ["id"] },
	type: "many_to_one",
};

const sampleSchema: ParsedSchema = {
	tables: [tableUsers, tableOrders, tableProducts],
	refs: [ordersToUsers],
	errors: [],
};

const diagram: Diagram = {
	source: "",
	parsedSchema: sampleSchema,
	tablePositions: {},
	stickyNotes: [],
};

const baseRuntime: ProjectionRuntimeState = {
	activeRelationTableIds: [],
	temporaryRelationship: null,
	searchHighlight: null,
};

describe("Canvas Runtime search highlight commands", () => {
	it("starts with no Search Highlight", () => {
		const store = createCanvasRuntimeStore();
		expect(store.getState().searchHighlight).toBeNull();
	});

	it("stores a Search Highlight set through setSearchHighlight", () => {
		const store = createCanvasRuntimeStore();
		store.getState().setSearchHighlight({
			matchedTableIds: ["users"],
			relatedTableIds: ["orders"],
			highlightedEdgeIds: ["fk_orders_users:0"],
		});

		expect(store.getState().searchHighlight).toEqual({
			matchedTableIds: ["users"],
			relatedTableIds: ["orders"],
			highlightedEdgeIds: ["fk_orders_users:0"],
		});
	});

	it("clears Search Highlight without touching Diagram state via clearSearchHighlight", () => {
		const store = createCanvasRuntimeStore();
		store.getState().setSearchHighlight({
			matchedTableIds: ["users"],
			relatedTableIds: [],
			highlightedEdgeIds: [],
		});
		store.getState().clearSearchHighlight();

		expect(store.getState().searchHighlight).toBeNull();
	});

	it("clears Search Highlight on dispose", () => {
		const store = createCanvasRuntimeStore();
		store.getState().setSearchHighlight({
			matchedTableIds: ["users"],
			relatedTableIds: [],
			highlightedEdgeIds: [],
		});
		store.getState().dispose();

		expect(store.getState().searchHighlight).toBeNull();
	});
});

describe("Canvas Projection search highlight visual state", () => {
	it("flags matched Tables with isSearchMatch and dims unrelated Tables", () => {
		const projection = buildCanvasProjection(diagram, {
			...baseRuntime,
			searchHighlight: {
				matchedTableIds: ["users"],
				relatedTableIds: ["orders"],
				highlightedEdgeIds: ["fk_orders_users:0"],
			},
		});

		const tableNodes = projection.nodes.filter((node) => node.type === "table");
		const usersNode = tableNodes.find((node) => node.id === "users");
		const ordersNode = tableNodes.find((node) => node.id === "orders");
		const productsNode = tableNodes.find((node) => node.id === "products");

		expect(usersNode?.data).toMatchObject({
			isSearchMatch: true,
			isSearchRelated: false,
			isSearchDimmed: false,
		});
		expect(ordersNode?.data).toMatchObject({
			isSearchMatch: false,
			isSearchRelated: true,
			isSearchDimmed: false,
		});
		expect(productsNode?.data).toMatchObject({
			isSearchMatch: false,
			isSearchRelated: false,
			isSearchDimmed: true,
		});
	});

	it("flags highlighted Relationship edges with isSearchMatch and dims others", () => {
		const projection = buildCanvasProjection(
			{
				...diagram,
				parsedSchema: {
					tables: [tableUsers, tableOrders, tableProducts],
					refs: [
						ordersToUsers,
						{
							id: "fk_products_users:0",
							from: { table: "products", columns: ["id"] },
							to: { table: "users", columns: ["id"] },
							type: "many_to_one",
						},
					],
					errors: [],
				},
			},
			{
				...baseRuntime,
				searchHighlight: {
					matchedTableIds: ["users"],
					relatedTableIds: ["orders", "products"],
					highlightedEdgeIds: ["fk_orders_users:0"],
				},
			},
		);

		const matchedEdge = projection.edges.find(
			(edge) => edge.id === "fk_orders_users:0",
		);
		const otherEdge = projection.edges.find(
			(edge) => edge.id === "fk_products_users:0",
		);

		expect(matchedEdge?.data).toMatchObject({
			isSearchMatch: true,
			isSearchDimmed: false,
		});
		expect(otherEdge?.data).toMatchObject({
			isSearchMatch: false,
			isSearchDimmed: true,
		});
	});

	it("leaves all Tables without search flags when there is no Search Highlight", () => {
		const projection = buildCanvasProjection(diagram, baseRuntime);

		for (const node of projection.nodes) {
			if (node.type !== "table") continue;
			expect(node.data).toMatchObject({
				isSearchMatch: false,
				isSearchRelated: false,
				isSearchDimmed: false,
			});
		}
	});
});
