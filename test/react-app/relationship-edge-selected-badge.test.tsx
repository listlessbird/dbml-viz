import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DiagramEdge } from "@/types";

const reactFlow = {
	getNode: vi.fn(),
	screenToFlowPosition: vi.fn((position: { x: number; y: number }) => position),
	isNodeIntersecting: vi.fn(() => false),
};

vi.mock("@xyflow/react", async () => {
	const React = await import("react");
	return {
		BaseEdge: ({
			id,
			path,
			style,
		}: {
			id: string;
			path: string;
			style?: React.CSSProperties;
		}) =>
			React.createElement("path", {
				"data-testid": "base-edge",
				"data-edge-id": id,
				d: path,
				style,
			}),
		EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) =>
			React.createElement("div", { "data-testid": "edge-label-renderer" }, children),
		getSmoothStepPath: () => ["M0,0 L100,20", 50, 20],
		useReactFlow: () => reactFlow,
	};
});

import { RelationshipEdge } from "@/components/RelationshipEdge";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
	if (root) {
		act(() => {
			root?.unmount();
		});
	}
	container?.remove();
	root = null;
	container = null;
	vi.clearAllMocks();
	reactFlow.screenToFlowPosition.mockImplementation(
		(position: { x: number; y: number }) => position,
	);
	reactFlow.isNodeIntersecting.mockReturnValue(false);
});

const baseData: DiagramEdge["data"] = {
	from: { table: "orders", columns: ["user_id"] },
	to: { table: "users", columns: ["id"] },
	relationText: "many to one",
	isSelected: false,
	isSearchMatch: false,
	isSearchDimmed: false,
	name: "fk_orders_users",
	onDelete: "cascade",
	onUpdate: "restrict",
};

const renderEdge = (
	options: {
		readonly selected?: boolean;
		readonly sourceX?: number;
		readonly targetX?: number;
		readonly data?: DiagramEdge["data"];
	} = {},
) => {
	container = document.createElement("div");
	document.body.appendChild(container);
	root = createRoot(container);
	act(() => {
		root!.render(
			<svg>
				{createElement(RelationshipEdge, {
					id: "fk_orders_users:0",
					source: "orders",
					target: "users",
					sourceX: options.sourceX ?? 0,
					sourceY: 0,
					targetX: options.targetX ?? 100,
					targetY: 20,
					markerEnd: "arrow",
					style: { stroke: "var(--primary)", strokeWidth: 2.3 },
					data: options.data ?? baseData,
					selected: options.selected ?? false,
				} as never)}
			</svg>,
		);
	});
	return container;
};

describe("RelationshipEdge selected badge", () => {
	it("does not mount or measure relation detail for unselected edges", async () => {
		const element = renderEdge({ selected: false });
		await act(async () => {});

		expect(element.querySelector("[data-testid='relationship-detail-badge']")).toBeNull();
		expect(reactFlow.getNode).not.toHaveBeenCalled();
		expect(reactFlow.isNodeIntersecting).not.toHaveBeenCalled();
		expect(element.querySelector("animateMotion")).toBeNull();
		expect(element.querySelector("[title]")).toBeNull();
	});

	it("mounts selected relation detail with endpoint and metadata content", async () => {
		reactFlow.getNode.mockImplementation((id: string) => ({ id }));

		const element = renderEdge({ selected: true });
		await act(async () => {});
		const badge = element.querySelector("[data-testid='relationship-detail-badge']");

		expect(badge?.textContent).toContain("orders.user_id");
		expect(badge?.textContent).toContain("users.id");
		expect(badge?.textContent).toContain("many to one");
		expect(badge?.textContent).toContain("fk_orders_users");
		expect(badge?.textContent).toContain("on delete cascade");
		expect(badge?.textContent).toContain("on update restrict");
		expect(reactFlow.isNodeIntersecting).toHaveBeenCalledTimes(2);
	});

	it("flips relation detail direction so the left-side endpoint is first", async () => {
		reactFlow.getNode.mockImplementation((id: string) => ({ id }));

		const element = renderEdge({ selected: true, sourceX: 100, targetX: 0 });
		await act(async () => {});
		const text = element.querySelector("[data-testid='relationship-detail-badge']")
			?.textContent;

		expect(text?.indexOf("users.id")).toBeLessThan(
			text?.indexOf("orders.user_id") ?? -1,
		);
		expect(text).toContain("←");
	});

	it("unmounts the selected badge when it intersects an endpoint Table", async () => {
		reactFlow.getNode.mockImplementation((id: string) => ({ id }));
		reactFlow.isNodeIntersecting.mockReturnValueOnce(true).mockReturnValue(false);

		const element = renderEdge({ selected: true });
		await act(async () => {});

		expect(element.querySelector("[data-testid='relationship-detail-badge']")).toBeNull();
		expect(reactFlow.isNodeIntersecting).toHaveBeenCalledTimes(2);
	});
});
