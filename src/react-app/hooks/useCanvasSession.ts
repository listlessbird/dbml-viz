import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";

import {
	buildDraftPayload,
	getPositionsFromNodes,
	type DiagramRouteState,
} from "@/lib/draftPersistence";
import { useSessionConnection } from "@/hooks/useSessionConnection";
import { useSessionStore } from "@/store/useSessionStore";
import { getSharedStickyNotes, useStickyNotesStore } from "@/store/useStickyNotesStore";
import type { DiagramNode, DiagramPositions, ParsedSchema, ParseDiagnostic, SchemaPayload } from "@/types";
import type { SessionSnapshot } from "@/types/session";

interface CanvasSessionOptions {
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
	readonly pushViewedRoute: (route: DiagramRouteState) => void;
	readonly setShareBaseline: Dispatch<
		SetStateAction<{ shareId: string; payload: SchemaPayload } | null>
	>;
	readonly setShareLoadError: (message: string | null) => void;
	readonly requestFitView: (nodeIds?: readonly string[]) => void;
	readonly handleRegularShare: () => void;
}

export function useCanvasSession({
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
	pushViewedRoute,
	setShareBaseline,
	setShareLoadError,
	requestFitView,
	handleRegularShare,
}: CanvasSessionOptions) {
	const status = useSessionStore((state) => state.status);
	const sessionId = useSessionStore((state) => state.sessionId);
	const pairingUrl = useSessionStore((state) => state.pairingUrl);
	const agentEditorLocked = useSessionStore((state) => state.agentEditorLocked);
	const isSharing = useSessionStore((state) => state.isSharing);
	const sendSessionMessage = useSessionStore((state) => state.send);
	const unlockEditor = useSessionStore((state) => state.unlockEditor);
	const setSessionSharing = useSessionStore((state) => state.setSharing);
	const sourceSendTimerRef = useRef<number | null>(null);
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

	const applySnapshot = useCallback((snapshot: SessionSnapshot) => {
		setSource(snapshot.source);
		applyPositions(snapshot.positions);
		useStickyNotesStore.getState().hydrate(snapshot.notes);
	}, [applyPositions, setSource]);

	const applyPatch = useCallback((patch: Partial<SessionSnapshot>) => {
		if (typeof patch.source === "string") setSource(patch.source);
		if (patch.positions) applyPositions(patch.positions);
		if (patch.notes) useStickyNotesStore.getState().hydrate(patch.notes);
	}, [applyPositions, setSource]);

	const handleShareResult = useCallback((id: string) => {
		const latest = latestRef.current;
		const payload = buildDraftPayload({
			source: latest.source,
			nodes: latest.canPersistNodePositions ? latest.nodes : [],
			fallbackPositions: latest.shareSeedPositions,
			notes: getSharedStickyNotes().filter((note) => note.text.trim().length > 0),
		});
		const nextUrl = new URL(`/s/${id}`, window.location.origin).toString();
		const isLiveSession = useSessionStore.getState().status === "live";

		void navigator.clipboard
			.writeText(nextUrl)
			.then(() => {
				if (isLiveSession) {
					toast.success(`Snapshot saved · /s/${id}`, {
						description: "Session continues. Future edits diverge from this baseline.",
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

	const { startSession, endSession } = useSessionConnection({
		applySnapshot,
		applyPatch,
		onFocusTables: requestFitView,
		onShareResult: handleShareResult,
		onExpired: () => {
			const expiredId = useSessionStore.getState().sessionId;
			useSessionStore.getState().reset();
			toast.error("Session expired", {
				description: `${expiredId ?? "session"} ended after 1h idle. Your local changes were restored.`,
			});
		},
	});

	const handleSourceChange = useCallback((nextSource: string) => {
		setSource(nextSource);
		if (useSessionStore.getState().status !== "live") return;
		if (sourceSendTimerRef.current !== null) {
			window.clearTimeout(sourceSendTimerRef.current);
		}
		sourceSendTimerRef.current = window.setTimeout(() => {
			useSessionStore.getState().send({ type: "set-source", source: nextSource });
		}, 300);
	}, [setSource]);

	useEffect(() => {
		if (status !== "live") return;
		sendSessionMessage({
			type: "set-diagnostics",
			diagnostics,
			tableCount: diagnostics.length > 0 ? 0 : parsed.tables.length,
			refCount: diagnostics.length > 0 ? 0 : parsed.refs.length,
		});
	}, [diagnostics, parsed.refs.length, parsed.tables.length, sendSessionMessage, status]);

	useEffect(() => {
		if (status !== "live" || !canPersistNodePositions) return;
		if (positionSendTimerRef.current !== null) {
			window.clearTimeout(positionSendTimerRef.current);
		}
		positionSendTimerRef.current = window.setTimeout(() => {
			useSessionStore.getState().send({
				type: "set-positions",
				positions: getPositionsFromNodes(nodes),
			});
		}, 500);
		return () => {
			if (positionSendTimerRef.current !== null) window.clearTimeout(positionSendTimerRef.current);
		};
	}, [canPersistNodePositions, nodes, status]);

	useEffect(() => {
		if (status !== "live") return;
		let timeoutId: number | null = null;
		const scheduleNotesSync = () => {
			if (timeoutId !== null) window.clearTimeout(timeoutId);
			timeoutId = window.setTimeout(() => {
				useSessionStore.getState().send({ type: "set-notes", notes: getSharedStickyNotes() });
			}, 500);
		};
		const unsubscribe = useStickyNotesStore.subscribe(scheduleNotesSync);
		scheduleNotesSync();
		return () => {
			if (timeoutId !== null) window.clearTimeout(timeoutId);
			unsubscribe();
		};
	}, [status]);

	useEffect(() => {
		return () => {
			if (sourceSendTimerRef.current !== null) window.clearTimeout(sourceSendTimerRef.current);
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
		const positions = latest.canPersistNodePositions
			? getPositionsFromNodes(latest.nodes)
			: latest.shareSeedPositions;
		startSession(
			{
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
			},
			latest.viewedRoute,
		);
	}, [startSession, status]);

	const handleShare = useCallback(() => {
		if (status !== "live") {
			handleRegularShare();
			return;
		}
		setSessionSharing(true);
		if (!sendSessionMessage({ type: "share-request" })) {
			setSessionSharing(false);
			toast.error("Session is not connected.");
		}
	}, [handleRegularShare, sendSessionMessage, setSessionSharing, status]);

	return {
		status,
		sessionId,
		pairingUrl,
		agentEditorLocked,
		isSharing,
		isEditorReadOnly: status === "reconnecting" || agentEditorLocked,
		handleConnect,
		handleDisconnect: endSession,
		handleShare,
		handleSourceChange,
		unlockEditor,
	};
}
