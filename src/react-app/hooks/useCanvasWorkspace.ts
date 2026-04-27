import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";

import {
	buildDraftPayload,
	getPositionsFromNodes,
	resolveDraftPersistence,
	type DiagramRouteState,
} from "@/lib/draftPersistence";
import { SAMPLE_SCHEMA_SOURCE } from "@/lib/sample-dbml";
import { useWorkspaceConnection } from "@/hooks/useWorkspaceConnection";
import { useWorkspaceStore } from "@/store/useWorkspaceStore";
import { getSharedStickyNotes, useStickyNotesStore } from "@/store/useStickyNotesStore";
import type { DiagramNode, DiagramPositions, ParsedSchema, ParseDiagnostic, SchemaPayload } from "@/types";
import type { WorkspaceSnapshot } from "@/types/workspace";

interface CanvasWorkspaceOptions {
	readonly source: string;
	readonly nodes: readonly DiagramNode[];
	readonly parsed: ParsedSchema;
	readonly diagnostics: readonly ParseDiagnostic[];
	readonly canPersistNodePositions: boolean;
	readonly shareSeedPositions: DiagramPositions;
	readonly isLoadingShare: boolean;
	readonly viewedRoute: DiagramRouteState;
	readonly currentShareBaseline: SchemaPayload | null;
	readonly setSource: (source: string) => void;
	readonly setNodes: Dispatch<SetStateAction<DiagramNode[]>>;
	readonly setShareSeedPositions: (positions: DiagramPositions) => void;
	readonly clearDraft: (shareId: string | null) => void;
	readonly setDraft: (shareId: string | null, payload: SchemaPayload) => void;
	readonly pushViewedRoute: (route: DiagramRouteState) => void;
	readonly setShareBaseline: Dispatch<
		SetStateAction<{ shareId: string; payload: SchemaPayload } | null>
	>;
	readonly setShareLoadError: (message: string | null) => void;
	readonly requestFitView: (nodeIds?: readonly string[]) => void;
	readonly handleRegularShare: () => void;
}

export function useCanvasWorkspace({
	source,
	nodes,
	parsed,
	diagnostics,
	canPersistNodePositions,
	shareSeedPositions,
	isLoadingShare,
	viewedRoute,
	currentShareBaseline,
	setSource,
	setNodes,
	setShareSeedPositions,
	clearDraft,
	setDraft,
	pushViewedRoute,
	setShareBaseline,
	setShareLoadError,
	requestFitView,
	handleRegularShare,
}: CanvasWorkspaceOptions) {
	const status = useWorkspaceStore((state) => state.status);
	const workspaceId = useWorkspaceStore((state) => state.workspaceId);
	const workspaceUrl = useWorkspaceStore((state) => state.workspaceUrl);
	const agentEditorLocked = useWorkspaceStore((state) => state.agentEditorLocked);
	const isSharing = useWorkspaceStore((state) => state.isSharing);
	const sendWorkspaceMessage = useWorkspaceStore((state) => state.send);
	const unlockEditor = useWorkspaceStore((state) => state.unlockEditor);
	const setWorkspaceSharing = useWorkspaceStore((state) => state.setSharing);
	const positionSendTimerRef = useRef<number | null>(null);
	const latestRef = useRef({
		source,
		nodes,
		canPersistNodePositions,
		shareSeedPositions,
		isLoadingShare,
		viewedRoute,
		currentShareBaseline,
	});

	useEffect(() => {
		latestRef.current = {
			source,
			nodes,
			canPersistNodePositions,
			shareSeedPositions,
			isLoadingShare,
			viewedRoute,
			currentShareBaseline,
		};
	}, [
		canPersistNodePositions,
		currentShareBaseline,
		isLoadingShare,
		nodes,
		shareSeedPositions,
		source,
		viewedRoute,
	]);

	const applyPositions = useCallback((positions: DiagramPositions) => {
		setShareSeedPositions(positions);
		setNodes((currentNodes) =>
			currentNodes.map((node) => {
				const position = positions[node.id];
				return position ? { ...node, position } : node;
			}),
		);
	}, [setNodes, setShareSeedPositions]);

	const applySnapshot = useCallback((snapshot: WorkspaceSnapshot) => {
		setSource(snapshot.source);
		applyPositions(snapshot.positions);
		useStickyNotesStore.getState().hydrate(snapshot.notes);
	}, [applyPositions, setSource]);

	const applyPatch = useCallback((patch: Partial<WorkspaceSnapshot>) => {
		if (typeof patch.source === "string") setSource(patch.source);
		if (patch.positions) applyPositions(patch.positions);
		if (patch.notes) useStickyNotesStore.getState().hydrate(patch.notes);

		if (
			typeof patch.source === "string" ||
			patch.positions !== undefined ||
			patch.notes !== undefined
		) {
			const latest = latestRef.current;
			const positions =
				patch.positions ??
				(latest.canPersistNodePositions
					? getPositionsFromNodes(latest.nodes)
					: latest.shareSeedPositions);
			const payload = buildDraftPayload({
				source: patch.source ?? latest.source,
				nodes: [],
				fallbackPositions: positions,
				notes: patch.notes ?? getSharedStickyNotes(),
			});
			const decision = resolveDraftPersistence({
				route: latest.viewedRoute,
				payload,
				sampleSource: SAMPLE_SCHEMA_SOURCE,
				baseline: latest.currentShareBaseline,
				rootBaseline: null,
			});

			if (decision.shouldClearDraft) clearDraft(latest.viewedRoute.shareId);
			if (decision.shouldStoreDraft) setDraft(latest.viewedRoute.shareId, payload);
		}
	}, [applyPositions, clearDraft, setDraft, setSource]);

	const handleShareResult = useCallback((id: string) => {
		const latest = latestRef.current;
		const payload = buildDraftPayload({
			source: latest.source,
			nodes: latest.canPersistNodePositions ? latest.nodes : [],
			fallbackPositions: latest.shareSeedPositions,
			notes: getSharedStickyNotes().filter((note) => note.text.trim().length > 0),
		});
		const nextUrl = new URL(`/s/${id}`, window.location.origin).toString();
		const isLiveWorkspace = useWorkspaceStore.getState().status === "live";

		void navigator.clipboard
			.writeText(nextUrl)
			.then(() => {
				if (isLiveWorkspace) {
					toast.success(`Snapshot saved · /s/${id}`, {
						description: "Workspace continues. Future edits diverge from this baseline.",
					});
				} else {
					toast.success("Share link copied to clipboard.");
				}
			})
			.catch(() => toast.success("Share created.", { description: nextUrl }));

		if (latest.viewedRoute.shareId !== null) clearDraft(latest.viewedRoute.shareId);
		pushViewedRoute({ shareId: id, isDirty: false });
		setShareSeedPositions(payload.positions);
		setShareBaseline({ shareId: id, payload });
		setShareLoadError(null);
	}, [
		clearDraft,
		pushViewedRoute,
		setShareBaseline,
		setShareLoadError,
		setShareSeedPositions,
	]);

	const getCurrentWorkspaceSeed = useCallback(() => {
		const latest = latestRef.current;
		const positions = latest.canPersistNodePositions
			? getPositionsFromNodes(latest.nodes)
			: latest.shareSeedPositions;

		return {
			source: latest.source,
			positions,
			notes: getSharedStickyNotes(),
			baseline:
				latest.currentShareBaseline && latest.viewedRoute.shareId !== null
					? {
							shareId: latest.viewedRoute.shareId,
							source: latest.currentShareBaseline.source,
							positions: latest.currentShareBaseline.positions,
							notes: latest.currentShareBaseline.notes,
						}
					: null,
		};
	}, []);

	const { startWorkspace, endWorkspace, markLocalWorkspaceChanged } = useWorkspaceConnection({
		getCurrentSeed: getCurrentWorkspaceSeed,
		applySnapshot,
		applyPatch,
		onFocusTables: requestFitView,
		onShareResult: handleShareResult,
		onExpired: () => {
			const expiredId = useWorkspaceStore.getState().workspaceId;
			useWorkspaceStore.getState().reset();
			toast.error("Workspace expired", {
				description: `${expiredId ?? "workspace"} was cleared after 30 days idle. Your local changes were restored.`,
			});
		},
	});

	const handleSourceChange = useCallback((nextSource: string) => {
		if (useWorkspaceStore.getState().status !== "offline") return;
		setSource(nextSource);
	}, [setSource]);

	useEffect(() => {
		if (status !== "live") return;
		sendWorkspaceMessage({
			type: "set-diagnostics",
			diagnostics,
			tableCount: diagnostics.length > 0 ? 0 : parsed.tables.length,
			refCount: diagnostics.length > 0 ? 0 : parsed.refs.length,
		});
	}, [diagnostics, parsed.refs.length, parsed.tables.length, sendWorkspaceMessage, status]);

	useEffect(() => {
		if (status !== "live" || !canPersistNodePositions) return;
		if (positionSendTimerRef.current !== null) {
			window.clearTimeout(positionSendTimerRef.current);
		}
		positionSendTimerRef.current = window.setTimeout(() => {
			useWorkspaceStore.getState().send({
				type: "set-positions",
				positions: getPositionsFromNodes(nodes),
			});
			markLocalWorkspaceChanged();
		}, 500);
		return () => {
			if (positionSendTimerRef.current !== null) window.clearTimeout(positionSendTimerRef.current);
		};
	}, [canPersistNodePositions, markLocalWorkspaceChanged, nodes, status]);

	useEffect(() => {
		if (status !== "live") return;
		let timeoutId: number | null = null;
		const scheduleNotesSync = () => {
			if (timeoutId !== null) window.clearTimeout(timeoutId);
			timeoutId = window.setTimeout(() => {
				useWorkspaceStore.getState().send({ type: "set-notes", notes: getSharedStickyNotes() });
				markLocalWorkspaceChanged();
			}, 500);
		};
		const unsubscribe = useStickyNotesStore.subscribe(scheduleNotesSync);
		scheduleNotesSync();
		return () => {
			if (timeoutId !== null) window.clearTimeout(timeoutId);
			unsubscribe();
		};
	}, [markLocalWorkspaceChanged, status]);

	useEffect(() => {
		return () => {
			if (positionSendTimerRef.current !== null) window.clearTimeout(positionSendTimerRef.current);
		};
	}, []);

	const handleConnect = useCallback(() => {
		const latest = latestRef.current;
		if (status !== "offline") return;
		if (latest.isLoadingShare) {
			toast.error("Wait for the shared schema to finish loading before connecting.");
			return;
		}
		startWorkspace(getCurrentWorkspaceSeed());
	}, [getCurrentWorkspaceSeed, startWorkspace, status]);

	const handleShare = useCallback(() => {
		if (status !== "live") {
			handleRegularShare();
			return;
		}
		setWorkspaceSharing(true);
		if (!sendWorkspaceMessage({ type: "share-request" })) {
			setWorkspaceSharing(false);
			toast.error("Workspace is not connected.");
		}
	}, [handleRegularShare, sendWorkspaceMessage, setWorkspaceSharing, status]);

	return {
		status,
		workspaceId,
		workspaceUrl,
		agentEditorLocked,
		isSharing,
		isEditorReadOnly: status !== "offline" || agentEditorLocked,
		handleConnect,
		handleDisconnect: endWorkspace,
		handleShare,
		handleSourceChange,
		unlockEditor,
	};
}
