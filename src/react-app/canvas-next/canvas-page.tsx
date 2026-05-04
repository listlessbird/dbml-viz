import {
	Suspense,
	lazy,
	useCallback,
	useContext,
	useState,
	type PropsWithChildren,
} from "react";

import { CanvasRuntimeProvider } from "@/canvas-next/canvas-runtime-provider";
import { CanvasNextCanvas } from "@/canvas-next/canvas";
import { CanvasSearchDock } from "@/canvas-next/canvas-search-popover";
import { CanvasNextToolbar } from "@/canvas-next/canvas-toolbar";
import { ShareButton } from "@/components/ShareButton";
import { WorkspaceStatusPill } from "@/components/agent-connectivity/WorkspaceStatusPill";
import {
	type DiagramPersistenceAdapter,
	type DraftPersistenceAdapter,
	withSharePersistenceAdapter,
} from "@/canvas-next/diagram-persistence-adapter";
import { applyWorkspaceShareResult } from "@/canvas-next/diagram-persistence";
import { DraftPersistenceProvider } from "@/canvas-next/diagram-persistence-context";
import { useDraftPersistence } from "@/canvas-next/use-draft-persistence";
import { useSharePersistence } from "@/canvas-next/use-share-persistence";
import type { Diagram } from "@/diagram-session/diagram-session-context";
import {
	DiagramSessionContext,
	useDiagramSession,
} from "@/diagram-session/diagram-session-context";
import { DiagramSessionProvider } from "@/diagram-session/diagram-session-provider";
import { emptyDiagram } from "@/diagram-session/diagram-session-store";
import {
	getDiagramRouteState,
	getDraftHydrationResult,
} from "@/lib/draftPersistence";
import { useRouting } from "@/hooks/useRouting";
import { SAMPLE_SCHEMA_SOURCE } from "@/lib/sample-dbml";
import { WorkspaceProvider } from "@/workspace/workspace-provider";
import { useWorkspace } from "@/workspace/workspace-context";
import type { WorkspaceStatus } from "@/types/workspace";
import type { WorkspaceStoreAdapters } from "@/workspace/workspace-store";

const LazySchemaSourceEditorPanel = lazy(() =>
	import("@/schema-source-editor/schema-source-editor").then((module) => ({
		default: module.SchemaSourceEditorPanel,
	})),
);

export interface CanvasNextPageProps {
	readonly adapter?: DraftPersistenceAdapter | DiagramPersistenceAdapter;
	readonly workspaceAdapter?: Partial<WorkspaceStoreAdapters>;
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

function CanvasNextWorkspaceProvider({
	routing,
	persistenceAdapter,
	workspaceAdapter,
	children,
}: PropsWithChildren<{
	readonly routing: ReturnType<typeof useRouting>;
	readonly persistenceAdapter: DiagramPersistenceAdapter;
	readonly workspaceAdapter?: Partial<WorkspaceStoreAdapters>;
}>) {
	const diagramStore = useContext(DiagramSessionContext);
	if (!diagramStore) {
		throw new Error(
			"CanvasNextWorkspaceProvider must be used inside DiagramSessionProvider",
		);
	}

	const getCurrentSeed = useCallback(() => {
		const payload = diagramStore.getState().toSchemaPayload();
		const shareBaseline = routing.currentShareBaseline;
		return {
			source: payload.source,
			positions: payload.positions,
			notes: payload.notes,
			baseline:
				shareBaseline && routing.viewedRoute.shareId !== null
					? {
							shareId: routing.viewedRoute.shareId,
							source: shareBaseline.source,
							positions: shareBaseline.positions,
							notes: shareBaseline.notes,
						}
					: null,
		};
	}, [diagramStore, routing.currentShareBaseline, routing.viewedRoute.shareId]);
	const handleShareResult = useCallback(
		(shareId: string) => {
			applyWorkspaceShareResult({
				adapter: persistenceAdapter,
				sessionStore: diagramStore,
				shareId,
				currentShareId: routing.viewedRoute.shareId,
				setShareBaseline: routing.setShareBaseline,
				pushViewedRoute: routing.pushViewedRoute,
			});
		},
		[
			diagramStore,
			persistenceAdapter,
			routing.pushViewedRoute,
			routing.setShareBaseline,
			routing.viewedRoute.shareId,
		],
	);

	return (
		<WorkspaceProvider
			getCurrentSeed={getCurrentSeed}
			handleShareResult={handleShareResult}
			adapter={workspaceAdapter}
		>
			{children}
		</WorkspaceProvider>
	);
}

const workspaceLabel = (status: WorkspaceStatus) => {
	switch (status) {
		case "offline":
			return "Connect workspace";
		case "connecting":
			return "Connecting";
		case "live":
			return "Live";
		case "reconnecting":
			return "Reconnecting";
		case "ended":
			return "Workspace expired";
	}
};

function CanvasNextWorkspaceAction() {
	const status = useWorkspace((state) => state.status);
	const workspaceId = useWorkspace((state) => state.workspaceId);
	const attach = useWorkspace((state) => state.attach);
	const detach = useWorkspace((state) => state.detach);
	const handleClick =
		status === "offline" || status === "ended"
			? attach
			: status === "live"
				? detach
				: undefined;

	return (
		<WorkspaceStatusPill
			status={status}
			tone="light"
			label={workspaceLabel(status)}
			hint={status === "live" ? workspaceId ?? undefined : undefined}
			onClick={handleClick}
		/>
	);
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
			<div className="flex shrink-0 items-center gap-2">
				<CanvasNextWorkspaceAction />
				<ShareButton isSharing={isSharing} onShare={onShare} />
			</div>
		</header>
	);
}

function CanvasNextContent({ routing }: CanvasNextContentProps) {
	const [isSourceEditorOpen, setIsSourceEditorOpen] = useState(false);
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
	const toggleSourceEditor = useCallback(() => {
		setIsSourceEditorOpen((isOpen) => !isOpen);
	}, []);

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
				<CanvasNextToolbar
					isSourceEditorOpen={isSourceEditorOpen}
					onToggleSourceEditor={toggleSourceEditor}
				/>
				<CanvasSearchDock />
				{isSourceEditorOpen ? (
					<div className="absolute inset-y-0 right-0 z-20 w-full border-l border-border bg-background shadow-2xl sm:max-w-[440px]">
						<Suspense
							fallback={
								<div className="flex h-full items-center justify-center text-xs text-muted-foreground">
									Loading schema source
								</div>
							}
						>
							<LazySchemaSourceEditorPanel
								onRequestClose={() => setIsSourceEditorOpen(false)}
							/>
						</Suspense>
					</div>
				) : null}
			</section>
		</main>
	);
}

export function CanvasNextPage({
	adapter: providedAdapter,
	workspaceAdapter,
}: CanvasNextPageProps = {}) {
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
					<CanvasNextWorkspaceProvider
						routing={routing}
						persistenceAdapter={adapter}
						workspaceAdapter={workspaceAdapter}
					>
						<DraftPersistenceBridge routing={routing} />
						<CanvasNextContent routing={routing} />
					</CanvasNextWorkspaceProvider>
				</CanvasRuntimeProvider>
			</DraftPersistenceProvider>
		</DiagramSessionProvider>
	);
}
