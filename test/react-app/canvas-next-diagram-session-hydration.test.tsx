import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import {
	useDiagramSession,
} from "@/diagram-session/diagram-session-context";
import { DiagramSessionProvider } from "@/diagram-session/diagram-session-provider";
import type { Diagram } from "@/diagram-session/diagram-session-context";

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
});

function SourceProbe({ onSource }: { onSource: (source: string) => void }) {
	const source = useDiagramSession((state) => state.diagram.source);
	onSource(source);
	return null;
}

describe("DiagramSessionProvider initial hydration", () => {
	it("exposes the provided initial Diagram on first render", () => {
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);

		const initialDiagram: Diagram = {
			source: "Table users { id int }",
			parsedSchema: { tables: [], refs: [], errors: [] },
			tablePositions: { users: { x: 5, y: 7 } },
			stickyNotes: [],
		};

		const observed: string[] = [];

		act(() => {
			root?.render(
				<DiagramSessionProvider initialDiagram={initialDiagram}>
					<SourceProbe onSource={(source) => observed.push(source)} />
				</DiagramSessionProvider>,
			);
		});

		expect(observed[0]).toBe("Table users { id int }");
	});
});
