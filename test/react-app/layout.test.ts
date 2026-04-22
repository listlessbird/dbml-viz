import { describe, expect, it } from "vitest";

import { buildElkLayoutGraph, doDiagramNodesOverlap } from "@/lib/layout";
import { parseDbmlSource } from "@/lib/dbml-schema";
import {
	getRelationSourceHandleId,
	getRelationTargetHandleId,
} from "@/lib/relation-handles";
import { buildDiagram } from "@/lib/transform";

describe("buildElkLayoutGraph", () => {
	it("includes composite relation ports so ELK can route multi-column refs", () => {
		const parsed = parseDbmlSource(`
			Table parent {
			  tenant_id int [not null]
			  id int [not null]

			  indexes {
			    (tenant_id, id) [pk]
			  }
			}

			Table child {
			  tenant_id int [not null]
			  parent_id int [not null]
			}

			Ref variants_to_products: child.(tenant_id, parent_id) > parent.(tenant_id, id)
		`);
		const [ref] = parsed.refs;
		const diagram = buildDiagram(parsed);
		const graph = buildElkLayoutGraph(diagram.nodes, diagram.edges, "left-right");
		const childNode = graph.children.find((node) => node.id === "child");
		const parentNode = graph.children.find((node) => node.id === "parent");
		const edge = graph.edges.find((candidate) => candidate.id === ref?.id);

		expect(childNode?.ports).toContainEqual({
			id: getRelationSourceHandleId(ref.id),
			properties: {
				"org.eclipse.elk.port.side": "EAST",
			},
		});
		expect(parentNode?.ports).toContainEqual({
			id: getRelationTargetHandleId(ref.id),
			properties: {
				"org.eclipse.elk.port.side": "WEST",
			},
		});
		expect(edge?.sources).toEqual([getRelationSourceHandleId(ref.id)]);
		expect(edge?.targets).toEqual([getRelationTargetHandleId(ref.id)]);
	});

	it("detects overlapping saved node bounds", () => {
		expect(
			doDiagramNodesOverlap([
				{
					position: { x: 80, y: 80 },
					width: 320,
					height: 240,
				},
				{
					position: { x: 240, y: 180 },
					width: 320,
					height: 240,
				},
			]),
		).toBe(true);

		expect(
			doDiagramNodesOverlap([
				{
					position: { x: 80, y: 80 },
					width: 320,
					height: 240,
				},
				{
					position: { x: 440, y: 80 },
					width: 320,
					height: 240,
				},
			]),
		).toBe(false);
	});
});
