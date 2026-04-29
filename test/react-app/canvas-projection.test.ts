import { describe, expect, it } from "vitest";

import { buildCanvasProjection } from "@/canvas-next/canvas-projection";
import type { Diagram } from "@/diagram-session/diagram-session-context";
import type { DiagramEdge, ParsedSchema, RefData, TableData } from "@/types";

const tableUsers = {
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
} as const;

const tableOrders = {
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
	],
	indexes: [],
} as const;

const usersAndOrders: ParsedSchema = {
	tables: [tableUsers, tableOrders],
	refs: [],
	errors: [],
};

const usersOnly: ParsedSchema = {
	tables: [tableUsers],
	refs: [],
	errors: [],
};

const buildDiagram = (parsedSchema: ParsedSchema, tablePositions = {}): Diagram => ({
	source: "",
	parsedSchema,
	tablePositions,
	stickyNotes: [],
});

const projectionRuntime = {
	activeRelationTableIds: [] as readonly string[],
	temporaryRelationship: null,
};

describe("Canvas Projection table nodes", () => {
	it("projects one React Flow node per Parsed Schema Table with the Table id as node id", () => {
		const projection = buildCanvasProjection(
			buildDiagram(usersAndOrders),
			projectionRuntime,
		);

		expect(projection.nodes.map((node) => node.id).sort()).toEqual(
			["orders", "users"].sort(),
		);
		expect(projection.nodes.every((node) => node.type === "table")).toBe(true);
		expect(projection.edges).toEqual([]);
	});

	it("preserves committed Table Positions for projected nodes", () => {
		const projection = buildCanvasProjection(
			buildDiagram(usersAndOrders, {
				users: { x: 100, y: 200 },
			}),
			projectionRuntime,
		);

		const usersNode = projection.nodes.find((node) => node.id === "users");
		expect(usersNode?.position).toEqual({ x: 100, y: 200 });
	});

	it("removes the projected node when its Table is absent from a replaced Parsed Schema", () => {
		const before = buildCanvasProjection(
			buildDiagram(usersAndOrders),
			projectionRuntime,
		);
		expect(before.nodes.map((node) => node.id)).toContain("orders");

		const after = buildCanvasProjection(
			buildDiagram(usersOnly),
			projectionRuntime,
		);

		expect(after.nodes.map((node) => node.id)).toEqual(["users"]);
	});

	it("carries the Table data on the projected node so renderers do not refetch", () => {
		const projection = buildCanvasProjection(
			buildDiagram(usersOnly),
			projectionRuntime,
		);

		const usersNode = projection.nodes.find((node) => node.id === "users");
		expect(usersNode?.data.table).toBe(tableUsers);
	});
});

const ordersWithUserId: TableData = {
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

const userOrdersRef: RefData = {
	id: "orders:user_id->users:id:0",
	from: { table: "orders", columns: ["user_id"] },
	to: { table: "users", columns: ["id"] },
	type: "many_to_one",
};

const compositeChild: TableData = {
	id: "child",
	name: "child",
	columns: [
		{
			name: "tenant_id",
			type: "int",
			pk: false,
			notNull: true,
			unique: false,
			isForeignKey: true,
			isIndexed: false,
		},
		{
			name: "parent_id",
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

const compositeParent: TableData = {
	id: "parent",
	name: "parent",
	columns: [
		{
			name: "tenant_id",
			type: "int",
			pk: false,
			notNull: true,
			unique: false,
			isForeignKey: false,
			isIndexed: false,
		},
		{
			name: "id",
			type: "int",
			pk: false,
			notNull: true,
			unique: false,
			isForeignKey: false,
			isIndexed: false,
		},
	],
	indexes: [],
};

const compositeRef: RefData = {
	id: "fk_child_parent:0",
	from: { table: "child", columns: ["tenant_id", "parent_id"] },
	to: { table: "parent", columns: ["tenant_id", "id"] },
	type: "many_to_one",
	name: "fk_child_parent",
};

const usersWithOrders: ParsedSchema = {
	tables: [tableUsers, ordersWithUserId],
	refs: [userOrdersRef],
	errors: [],
};

const usersOnlyAfterRefRemoval: ParsedSchema = {
	tables: [tableUsers, ordersWithUserId],
	refs: [],
	errors: [],
};

const usersOnlyAfterTableRemoval: ParsedSchema = {
	tables: [tableUsers],
	refs: [],
	errors: [],
};

const compositeSchema: ParsedSchema = {
	tables: [compositeChild, compositeParent],
	refs: [compositeRef],
	errors: [],
};

const isDiagramEdge = (edge: { type?: string }): edge is DiagramEdge =>
	edge.type === "relationship";

describe("Canvas Projection relationship edges", () => {
	it("projects one React Flow edge per Relationship in the Parsed Schema", () => {
		const projection = buildCanvasProjection(
			buildDiagram(usersWithOrders),
			projectionRuntime,
		);

		const relationshipEdges = projection.edges.filter(isDiagramEdge);
		expect(relationshipEdges).toHaveLength(1);
		const [edge] = relationshipEdges;
		expect(edge?.id).toBe(userOrdersRef.id);
		expect(edge?.source).toBe("orders");
		expect(edge?.target).toBe("users");
	});

	it("uses Schema Model Relation Anchor ids as React Flow handles for single-column endpoints", () => {
		const projection = buildCanvasProjection(
			buildDiagram(usersWithOrders),
			projectionRuntime,
		);

		const [edge] = projection.edges.filter(isDiagramEdge);
		expect(edge?.sourceHandle).toBe("orders-user_id-source");
		expect(edge?.targetHandle).toBe("users-id-target");
	});

	it("uses ref-scoped Relation Anchor ids as React Flow handles for composite endpoints", () => {
		const projection = buildCanvasProjection(
			buildDiagram(compositeSchema),
			projectionRuntime,
		);

		const [edge] = projection.edges.filter(isDiagramEdge);
		expect(edge?.sourceHandle).toBe("fk_child_parent:0-source");
		expect(edge?.targetHandle).toBe("fk_child_parent:0-target");
	});

	it("populates composite Relation Anchors and handle offsets on the connected Table nodes", () => {
		const projection = buildCanvasProjection(
			buildDiagram(compositeSchema),
			projectionRuntime,
		);

		const childNode = projection.nodes.find((node) => node.id === "child");
		const parentNode = projection.nodes.find((node) => node.id === "parent");

		expect(childNode?.data.relationAnchors).toEqual([
			{
				id: "fk_child_parent:0-source",
				columns: ["tenant_id", "parent_id"],
				side: "source",
			},
		]);
		expect(parentNode?.data.relationAnchors).toEqual([
			{
				id: "fk_child_parent:0-target",
				columns: ["tenant_id", "id"],
				side: "target",
			},
		]);
		expect(
			childNode?.data.compositeHandleOffsets["fk_child_parent:0-source"],
		).toBeGreaterThan(0);
		expect(
			parentNode?.data.compositeHandleOffsets["fk_child_parent:0-target"],
		).toBeGreaterThan(0);
	});

	it("does not populate Relation Anchors for single-column endpoints (rendered per-column)", () => {
		const projection = buildCanvasProjection(
			buildDiagram(usersWithOrders),
			projectionRuntime,
		);

		const ordersNode = projection.nodes.find((node) => node.id === "orders");
		expect(ordersNode?.data.relationAnchors).toEqual([]);
		expect(ordersNode?.data.compositeHandleOffsets).toEqual({});
	});

	it("removes the projected edge when its Relationship disappears from the Parsed Schema", () => {
		const before = buildCanvasProjection(
			buildDiagram(usersWithOrders),
			projectionRuntime,
		);
		expect(before.edges.filter(isDiagramEdge)).toHaveLength(1);

		const after = buildCanvasProjection(
			buildDiagram(usersOnlyAfterRefRemoval),
			projectionRuntime,
		);
		expect(after.edges.filter(isDiagramEdge)).toHaveLength(0);
	});

	it("removes all connected relationship edges when a Table disappears from the Parsed Schema", () => {
		const before = buildCanvasProjection(
			buildDiagram(usersWithOrders),
			projectionRuntime,
		);
		expect(before.edges.filter(isDiagramEdge)).toHaveLength(1);

		const after = buildCanvasProjection(
			buildDiagram(usersOnlyAfterTableRemoval),
			projectionRuntime,
		);
		expect(after.nodes.map((node) => node.id)).toEqual(["users"]);
		expect(after.edges.filter(isDiagramEdge)).toHaveLength(0);
	});

	it("guards against orphan Relationships whose endpoint Tables are not in the Parsed Schema", () => {
		const orphanSchema: ParsedSchema = {
			tables: [tableUsers],
			refs: [userOrdersRef],
			errors: [],
		};

		const projection = buildCanvasProjection(
			buildDiagram(orphanSchema),
			projectionRuntime,
		);

		expect(projection.edges.filter(isDiagramEdge)).toHaveLength(0);
	});
});

describe("Canvas Projection relation hover input", () => {
	it("marks edges connected to Canvas Runtime active Relation tables as active", () => {
		const projection = buildCanvasProjection(
			buildDiagram(usersWithOrders),
			{
				activeRelationTableIds: ["orders"],
				temporaryRelationship: null,
			},
		);

		const [edge] = projection.edges.filter(isDiagramEdge);
		expect(edge?.data?.isRelationActive).toBe(true);
		expect(edge?.data?.isRelationSourceActive).toBe(true);
		expect(edge?.data?.isRelationTargetActive).toBe(false);
	});

	it("populates active Relation Columns on connected Table nodes from Canvas Runtime input", () => {
		const projection = buildCanvasProjection(
			buildDiagram(usersWithOrders),
			{
				activeRelationTableIds: ["orders"],
				temporaryRelationship: null,
			},
		);

		const ordersNode = projection.nodes.find((node) => node.id === "orders");
		const usersNode = projection.nodes.find((node) => node.id === "users");

		expect(ordersNode?.data.isRelationContextActive).toBe(true);
		expect(ordersNode?.data.activeRelationColumns).toEqual(["user_id"]);
		expect(usersNode?.data.isRelationContextActive).toBe(true);
		expect(usersNode?.data.activeRelationColumns).toEqual(["id"]);
	});

	it("leaves edges/nodes unmarked when no active Relation tables are present", () => {
		const projection = buildCanvasProjection(
			buildDiagram(usersWithOrders),
			projectionRuntime,
		);

		const [edge] = projection.edges.filter(isDiagramEdge);
		const ordersNode = projection.nodes.find((node) => node.id === "orders");

		expect(edge?.data?.isRelationActive).toBeUndefined();
		expect(ordersNode?.data.isRelationContextActive).toBeUndefined();
		expect(ordersNode?.data.activeRelationColumns).toBeUndefined();
	});

	it("does not mutate the source Diagram when relation hover is applied", () => {
		const diagram = buildDiagram(usersWithOrders);
		const snapshot = JSON.stringify(diagram);

		buildCanvasProjection(diagram, {
			activeRelationTableIds: ["orders"],
			temporaryRelationship: null,
		});

		expect(JSON.stringify(diagram)).toBe(snapshot);
	});
});

describe("Canvas Projection temporary runtime objects", () => {
	it("projects only whitelisted temporary relationship preview objects", () => {
		const projection = buildCanvasProjection(buildDiagram(usersWithOrders), {
			activeRelationTableIds: [],
			temporaryRelationship: {
				kind: "relationship-preview",
				sourceTableId: "orders",
				targetTableId: null,
				cursorPosition: { x: 360, y: 120 },
			},
		});

		expect(projection.nodes.map((node) => node.type)).toContain(
			"temporaryCursor",
		);
		expect(projection.edges.map((edge) => edge.type)).toContain(
			"temporaryRelationship",
		);
	});

	it("removes temporary relationship preview objects when runtime clears them", () => {
		const projection = buildCanvasProjection(buildDiagram(usersWithOrders), {
			activeRelationTableIds: [],
			temporaryRelationship: null,
		});

		expect(projection.nodes.map((node) => node.type)).not.toContain(
			"temporaryCursor",
		);
		expect(projection.edges.map((edge) => edge.type)).not.toContain(
			"temporaryRelationship",
		);
	});
});
