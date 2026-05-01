import { useState } from "react";

import { CanvasRuntimeProvider } from "@/canvas-next/canvas-runtime-provider";
import { CanvasNextCanvas } from "@/canvas-next/canvas";
import { CanvasSearchDock } from "@/canvas-next/canvas-search-popover";
import { ShareButton } from "@/components/ShareButton";
import {
	type DiagramPersistenceAdapter,
	type DraftPersistenceAdapter,
	withSharePersistenceAdapter,
} from "@/canvas-next/diagram-persistence-adapter";
import { DraftPersistenceProvider } from "@/canvas-next/diagram-persistence-context";
import { useDraftPersistence } from "@/canvas-next/use-draft-persistence";
import { useSharePersistence } from "@/canvas-next/use-share-persistence";
import type { Diagram } from "@/diagram-session/diagram-session-context";
import { useDiagramSession } from "@/diagram-session/diagram-session-context";
import { DiagramSessionProvider } from "@/diagram-session/diagram-session-provider";
import { emptyDiagram } from "@/diagram-session/diagram-session-store";
import {
	getDiagramRouteState,
	getDraftHydrationResult,
} from "@/lib/draftPersistence";
import { useRouting } from "@/hooks/useRouting";
import { SAMPLE_SCHEMA_SOURCE } from "@/lib/sample-dbml";

export interface CanvasNextPageProps {
	readonly adapter?: DraftPersistenceAdapter | DiagramPersistenceAdapter;
}

function buildInitialDiagram(
	adapter: DraftPersistenceAdapter,
	route: ReturnType<typeof getDiagramRouteState>,
): Diagram {
	const draft = adapter.getDraft(route.shareId);
	const hydration = getDraftHydrationResult({
		route,
		draft,
		sampleSource: SAMPLE_SCHEMA_SOURCE,
	});
	if (hydration.source.length === 0) return emptyDiagram;
	return {
		source: hydration.source,
		parsedSchema: emptyDiagram.parsedSchema,
		tablePositions: hydration.positions,
		stickyNotes: hydration.notes,
	};
}

function DraftPersistenceBridge({ routing }: CanvasNextContentProps) {
	useDraftPersistence({
		route: routing.viewedRoute,
		currentShareBaseline: routing.currentShareBaseline,
		onRouteDecision: routing.replaceViewedRoute,
	});
	return null;
}

interface CanvasNextContentProps {
	readonly routing: ReturnType<typeof useRouting>;
}

function CanvasNextHeader({
	isSharing,
	onShare,
	shareId,
	isDirty,
	tableCount,
	relationCount,
}: {
	readonly isSharing: boolean;
	readonly onShare: () => void;
	readonly shareId: string | null;
	readonly isDirty: boolean;
	readonly tableCount: number;
	readonly relationCount: number;
}) {
	return (
		<header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-border px-4">
			<div className="flex min-w-0 items-center gap-4">
				<div className="min-w-0">
					<h1 className="truncate text-sm font-semibold">dbml-viz</h1>
					<p className="truncate text-xs text-muted-foreground">
						{tableCount} {tableCount === 1 ? "table" : "tables"} /{" "}
						{relationCount} {relationCount === 1 ? "relationship" : "relationships"}
					</p>
				</div>
				{shareId ? (
					<div className="hidden min-w-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
						<span>Shared snapshot</span>
						<span className="font-mono">{shareId}</span>
						{isDirty ? <span>Local edits not shared</span> : null}
					</div>
				) : (
					<span className="hidden text-xs text-muted-foreground sm:inline">
						Auto-saved locally
					</span>
				)}
			</div>
			<ShareButton isSharing={isSharing} onShare={onShare} />
		</header>
	);
}

function CanvasNextContent({ routing }: CanvasNextContentProps) {
	const tableCount = useDiagramSession(
		(state) => state.diagram.parsedSchema.tables.length,
	);
	const relationCount = useDiagramSession(
		(state) => state.diagram.parsedSchema.refs.length,
	);
	const { isSharing, handleShare } = useSharePersistence({
		viewedRoute: routing.viewedRoute,
		currentShareBaseline: routing.shareBaseline,
		setShareBaseline: routing.setShareBaseline,
		pushViewedRoute: routing.pushViewedRoute,
	});

	return (
		<main
			data-testid="canvas-next-shell"
			className="flex h-screen min-h-0 flex-col bg-background text-foreground"
		>
			<CanvasNextHeader
				isSharing={isSharing}
				onShare={() => void handleShare()}
				shareId={routing.viewedRoute.shareId}
				isDirty={routing.viewedRoute.isDirty}
				tableCount={tableCount}
				relationCount={relationCount}
			/>
			<section className="relative min-h-0 flex-1">
				<CanvasNextCanvas />
				<CanvasSearchDock />
			</section>
		</main>
	);
}

export function CanvasNextPage({ adapter: providedAdapter }: CanvasNextPageProps = {}) {
	const [adapter] = useState<DiagramPersistenceAdapter>(
		() => withSharePersistenceAdapter(providedAdapter),
	);
	const [initialRoute] = useState(() =>
		getDiagramRouteState(window.location.pathname, window.location.search),
	);
	const routing = useRouting(initialRoute);
	const [initialDiagram] = useState<Diagram>(() =>
		buildInitialDiagram(adapter, initialRoute),
	);

	return (
		<DiagramSessionProvider initialDiagram={initialDiagram}>
			<DraftPersistenceProvider adapter={adapter}>
				<CanvasRuntimeProvider>
					<DraftPersistenceBridge routing={routing} />
					<CanvasNextContent routing={routing} />
				</CanvasRuntimeProvider>
			</DraftPersistenceProvider>
		</DiagramSessionProvider>
	);
}
