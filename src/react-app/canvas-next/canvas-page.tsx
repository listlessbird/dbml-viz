import { useState } from "react";

import { CanvasRuntimeProvider } from "@/canvas-next/canvas-runtime-provider";
import { CanvasNextCanvas } from "@/canvas-next/canvas";
import { CanvasSearchDock } from "@/canvas-next/canvas-search-popover";
import {
	createDefaultDraftPersistenceAdapter,
	type DraftPersistenceAdapter,
} from "@/canvas-next/diagram-persistence-adapter";
import { DraftPersistenceProvider } from "@/canvas-next/diagram-persistence-context";
import { useDraftPersistence } from "@/canvas-next/use-draft-persistence";
import type { Diagram } from "@/diagram-session/diagram-session-context";
import { DiagramSessionProvider } from "@/diagram-session/diagram-session-provider";
import { emptyDiagram } from "@/diagram-session/diagram-session-store";

export interface CanvasNextPageProps {
	readonly adapter?: DraftPersistenceAdapter;
}

function buildInitialDiagram(adapter: DraftPersistenceAdapter): Diagram {
	const draft = adapter.getDraft(null);
	if (!draft) return emptyDiagram;
	return {
		source: draft.source,
		parsedSchema: emptyDiagram.parsedSchema,
		tablePositions: draft.positions,
		stickyNotes: draft.notes,
	};
}

function DraftPersistenceBridge() {
	useDraftPersistence();
	return null;
}

export function CanvasNextPage({ adapter: providedAdapter }: CanvasNextPageProps = {}) {
	const [adapter] = useState<DraftPersistenceAdapter>(
		() => providedAdapter ?? createDefaultDraftPersistenceAdapter(),
	);
	const [initialDiagram] = useState<Diagram>(() => buildInitialDiagram(adapter));

	return (
		<DiagramSessionProvider initialDiagram={initialDiagram}>
			<DraftPersistenceProvider adapter={adapter}>
				<CanvasRuntimeProvider>
					<DraftPersistenceBridge />
					<main
						data-testid="canvas-next-shell"
						className="flex h-screen min-h-0 flex-col bg-background text-foreground"
					>
						<header className="flex h-12 shrink-0 items-center border-b border-border px-4">
							<div className="min-w-0">
								<h1 className="truncate text-sm font-semibold">dbml-viz</h1>
								<p className="truncate text-xs text-muted-foreground">
									Canvas Next
								</p>
							</div>
						</header>
						<section className="relative min-h-0 flex-1">
							<CanvasNextCanvas />
							<CanvasSearchDock />
						</section>
					</main>
				</CanvasRuntimeProvider>
			</DraftPersistenceProvider>
		</DiagramSessionProvider>
	);
}
