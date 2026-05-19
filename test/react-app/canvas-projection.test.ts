import { describe, expect, it } from "vitest";

import { buildCanvasProjection } from "@/canvas-next/canvas-projection";
import type { Diagram } from "@/diagram-session/diagram-session-context";
import type {
	DiagramEdge,
	DiagramNode,
	ParsedSchema,
	RefData,
	SharedStickyNote,
	TableData,
} from "@/types";

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

const buildDiagram = (
	parsedSchema: ParsedSchema,
	tablePositions?: Diagram["tablePositions"],
	stickyNotes: readonly SharedStickyNote[] = [],
): Diagram => ({
	source: "",
	parsedSchema,
	tablePositions:
		tablePositions ??
		Object.fromEntries(
			parsedSchema.tables.map((table, index) => [
				table.id,
				{ x: index * 300, y: 0 },
			]),
		),
	stickyNotes,
});

const projectionRuntime = {
	selectedRelationshipId: null,
	temporaryRelationship: null,
	searchHighlight: null,
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
				orders: { x: 300, y: 200 },
			}),
			projectionRuntime,
		);

		const usersNode = projection.nodes.find((node) => node.id === "users");
		expect(usersNode?.position).toEqual({ x: 100, y: 200 });
	});

	it("omits Tables that do not have Table Positions", () => {
		const projection = buildCanvasProjection(
			buildDiagram(usersAndOrders, {
				users: { x: 100, y: 200 },
			}),
			projectionRuntime,
		);

		expect(projection.nodes.map((node) => node.id)).toEqual(["users"]);
		expect(projection.missingPositionIds).toEqual(["orders"]);
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

const tableEmployees: TableData = {
	id: "employees",
	name: "employees",
	columns: [
		{ name: "id", type: "int", pk: true, notNull: true, unique: false, isForeignKey: false, isIndexed: true },
		{ name: "manager_id", type: "int", pk: false, notNull: false, unique: false, isForeignKey: true, isIndexed: false },
	],
	indexes: [],
};

const selfRef: RefData = {
	id: "employees:manager_id->employees:id:0",
	from: { table: "employees", columns: ["manager_id"] },
	to: { table: "employees", columns: ["id"] },
	type: "many_to_one",
};

const employeesWithSelfRef: ParsedSchema = {
	tables: [tableEmployees],
	refs: [selfRef],
	errors: [],
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

const paymentsWithOrderId: TableData = {
	id: "payments",
	name: "payments",
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
			name: "order_id",
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

const paymentOrdersRef: RefData = {
	id: "payments:order_id->orders:id:0",
	from: { table: "payments", columns: ["order_id"] },
	to: { table: "orders", columns: ["id"] },
	type: "many_to_one",
};

const usersOrdersAndPayments: ParsedSchema = {
	tables: [tableUsers, ordersWithUserId, paymentsWithOrderId],
	refs: [userOrdersRef, paymentOrdersRef],
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
const isDiagramNode = (node: { type?: string }): node is DiagramNode =>
	node.type === "table";

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

		const childNode = projection.nodes.find(
			(node): node is DiagramNode => node.id === "child" && isDiagramNode(node),
		);
		const parentNode = projection.nodes.find(
			(node): node is DiagramNode => node.id === "parent" && isDiagramNode(node),
		);

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

describe("Canvas Projection selected Relationship input", () => {
	it("marks the selected Relationship edge", () => {
		const projection = buildCanvasProjection(buildDiagram(usersWithOrders), {
			...projectionRuntime,
			selectedRelationshipId: userOrdersRef.id,
		});

		const [edge] = projection.edges.filter(isDiagramEdge);

		expect(edge?.selected).toBe(true);
		expect(edge?.data?.isSelected).toBe(true);
	});

	it("marks selected endpoint Tables and Columns", () => {
		const projection = buildCanvasProjection(buildDiagram(usersWithOrders), {
			...projectionRuntime,
			selectedRelationshipId: userOrdersRef.id,
		});

		const ordersNode = projection.nodes.find((node) => node.id === "orders");
		const usersNode = projection.nodes.find((node) => node.id === "users");

		expect(ordersNode?.data.isSelectedEndpoint).toBe(true);
		expect(ordersNode?.data.selectedRelationColumns).toEqual(["user_id"]);
		expect(usersNode?.data.isSelectedEndpoint).toBe(true);
		expect(usersNode?.data.selectedRelationColumns).toEqual(["id"]);
	});

	it("leaves edges/nodes unmarked when no Relationship is selected", () => {
		const projection = buildCanvasProjection(
			buildDiagram(usersWithOrders),
			projectionRuntime,
		);

		const [edge] = projection.edges.filter(isDiagramEdge);
		const ordersNode = projection.nodes.find((node) => node.id === "orders");

		expect(edge?.selected).toBe(false);
		expect(edge?.data?.isSelected).toBe(false);
		expect(ordersNode?.data.isSelectedEndpoint).toBe(false);
		expect(ordersNode?.data.selectedRelationColumns).toBeUndefined();
	});

	it("keeps selected Relationship emphasis visible when Search Highlight dims unrelated Relationships", () => {
		const projection = buildCanvasProjection(
			buildDiagram(usersOrdersAndPayments),
			{
				...projectionRuntime,
				selectedRelationshipId: paymentOrdersRef.id,
				searchHighlight: {
					matchedTableIds: ["users"],
					relatedTableIds: [],
					highlightedEdgeIds: [userOrdersRef.id],
				},
			},
		);

		const selectedEdge = projection.edges
			.filter(isDiagramEdge)
			.find((edge) => edge.id === paymentOrdersRef.id);
		const paymentsNode = projection.nodes.find((node) => node.id === "payments");

		expect(selectedEdge?.selected).toBe(true);
		expect(selectedEdge?.data?.isSearchDimmed).toBe(false);
		expect(paymentsNode?.data.isSelectedEndpoint).toBe(true);
		expect(paymentsNode?.data.isSearchDimmed).toBe(false);
	});

	it("highlights both FK and PK columns when a self-referential Relationship is selected", () => {
		const projection = buildCanvasProjection(
			buildDiagram(employeesWithSelfRef),
			{ ...projectionRuntime, selectedRelationshipId: selfRef.id },
		);

		const employeesNode = projection.nodes.find((n) => n.id === "employees");
		expect(employeesNode?.data.isSelectedEndpoint).toBe(true);
		expect(employeesNode?.data.selectedRelationColumns).toContain("manager_id");
		expect(employeesNode?.data.selectedRelationColumns).toContain("id");
	});

	it("does not mutate the source Diagram when selected Relationship emphasis is applied", () => {
		const diagram = buildDiagram(usersWithOrders);
		const snapshot = JSON.stringify(diagram);

		buildCanvasProjection(diagram, {
			...projectionRuntime,
			selectedRelationshipId: userOrdersRef.id,
		});

		expect(JSON.stringify(diagram)).toBe(snapshot);
	});
});

describe("Canvas Projection relation hover removal", () => {
	it("does not project hover-only Relation flags onto edges or Table nodes", () => {
		const projection = buildCanvasProjection(
			buildDiagram(usersWithOrders),
			projectionRuntime,
		);

		const [edge] = projection.edges.filter(isDiagramEdge);
		const ordersNode = projection.nodes.find((node) => node.id === "orders");

		expect(edge?.data?.isRelationActive).toBeUndefined();
		expect(edge?.data?.isRelationSourceActive).toBeUndefined();
		expect(edge?.data?.isRelationTargetActive).toBeUndefined();
		expect(ordersNode?.data.isRelationContextActive).toBeUndefined();
		expect(ordersNode?.data.activeRelationColumns).toBeUndefined();
	});
});

describe("Canvas Projection temporary runtime objects", () => {
	it("projects only whitelisted temporary relationship preview objects", () => {
		const projection = buildCanvasProjection(buildDiagram(usersWithOrders), {
			selectedRelationshipId: null,
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
			selectedRelationshipId: null,
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

describe("Canvas Projection Sticky Notes", () => {
	it("projects durable Sticky Notes as Canvas nodes", () => {
		const note: SharedStickyNote = {
			id: "sticky-1",
			color: "yellow",
			text: "Review users",
		};
		const projection = buildCanvasProjection(
			buildDiagram(usersOnly, {}, [note]),
			projectionRuntime,
		);

		const stickyNode = projection.nodes.find((node) => node.id === "sticky-1");
		expect(stickyNode).toMatchObject({
			id: "sticky-1",
			type: "sticky",
			position: { x: 0, y: 0 },
			data: { note },
		});
	});

	it("derives sticky link edges from Sticky Note text and Tables", () => {
		const note: SharedStickyNote = {
			id: "sticky-1",
			color: "blue",
			text: "Review #users.id and #missing",
		};
		const projection = buildCanvasProjection(
			buildDiagram(usersOnly, {}, [note]),
			projectionRuntime,
		);

		const stickyLink = projection.edges.find(
			(edge) => edge.type === "stickyLink",
		);
		expect(stickyLink).toMatchObject({
			id: "sticky-link-sticky-1-users-id",
			source: "sticky-1",
			target: "users",
			targetHandle: "users-id-target",
			type: "stickyLink",
			selectable: false,
			focusable: false,
			data: {
				color: "blue",
				tableName: "users",
				columnName: "id",
			},
		});
		expect(projection.edges.filter((edge) => edge.type === "stickyLink")).toHaveLength(
			1,
		);
	});

	it("removes derived sticky link edges when the Sticky Note is absent", () => {
		const note: SharedStickyNote = {
			id: "sticky-1",
			color: "green",
			text: "Review #users",
		};
		const before = buildCanvasProjection(
			buildDiagram(usersOnly, {}, [note]),
			projectionRuntime,
		);
		expect(before.edges.filter((edge) => edge.type === "stickyLink")).toHaveLength(
			1,
		);

		const after = buildCanvasProjection(
			buildDiagram(usersOnly, {}, []),
			projectionRuntime,
		);
		expect(after.nodes.map((node) => node.id)).not.toContain("sticky-1");
		expect(after.edges.filter((edge) => edge.type === "stickyLink")).toEqual([]);
	});

	it("preserves Sticky Note object identity through the projection so memos can skip work", () => {
		const note: SharedStickyNote = {
			id: "sticky-stable",
			color: "yellow",
			text: "About #users",
			x: 400,
			y: 300,
		};
		const projection = buildCanvasProjection(
			buildDiagram(usersOnly, {}, [note]),
			projectionRuntime,
		);

		const stickyNode = projection.nodes.find(
			(node) => node.id === "sticky-stable",
		);
		expect(stickyNode).toBeDefined();
		expect((stickyNode as { data: { note: SharedStickyNote } }).data.note).toBe(
			note,
		);
	});
});
