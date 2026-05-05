import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { LinkerMentionList } from "@/canvas-next/sticky-note/linker-popover";
import { Mention } from "@/components/ui/mention";
import type { TableData } from "@/types";

const usersTable: TableData = {
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
			isIndexed: false,
		},
	],
	indexes: [],
};

let activeRoot: Root | null = null;
let activeContainer: HTMLDivElement | null = null;

afterEach(() => {
	if (activeRoot) {
		act(() => {
			activeRoot?.unmount();
		});
	}
	activeContainer?.remove();
	activeRoot = null;
	activeContainer = null;
});

function renderMentionList(tables: readonly TableData[]) {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);

	act(() => {
		root.render(
			<Mention trigger="#">
				<LinkerMentionList tables={tables} />
			</Mention>,
		);
	});

	activeRoot = root;
	activeContainer = container;

	return container;
}

describe("LinkerMentionList", () => {
	it("renders table and table.column mention labels in full", () => {
		const container = renderMentionList([usersTable]);

		expect(container.textContent).toContain("users");
		expect(container.textContent).toContain("users.id");
	});

	it("allows long table and column names to wrap instead of clipping", () => {
		const container = renderMentionList([
			{
				...usersTable,
				id: "long-table",
				name: "users_with_a_very_long_reporting_identifier",
				columns: [
					{
						...usersTable.columns[0]!,
						name: "external_identity_provider_subject_identifier",
					},
				],
			},
		]);

		const longLabel = container.querySelector<HTMLElement>(
			"[data-slot='mention-item'] span.min-w-0",
		);

		expect(longLabel?.classList.contains("break-all")).toBe(true);
		expect(container.textContent).toContain(
			"users_with_a_very_long_reporting_identifier.external_identity_provider_subject_identifier",
		);
	});
});
