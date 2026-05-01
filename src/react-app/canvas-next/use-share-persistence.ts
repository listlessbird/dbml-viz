import { useCallback, useContext, useEffect, useState } from "react";
import { toast } from "sonner";

import {
	diagramFromSchemaPayload,
	readValidatedSharePayload,
	saveDiagramSessionShare,
	type ShareBaseline,
} from "@/canvas-next/diagram-persistence";
import { useDiagramPersistenceAdapter } from "@/canvas-next/diagram-persistence-context";
import { DiagramSessionContext } from "@/diagram-session/diagram-session-context";
import { emptyDiagram } from "@/diagram-session/diagram-session-store";
import type { DiagramRouteState } from "@/lib/draftPersistence";

export interface UseSharePersistenceOptions {
	readonly viewedRoute: DiagramRouteState;
	readonly currentShareBaseline: ShareBaseline | null;
	readonly setShareBaseline: (baseline: ShareBaseline | null) => void;
	readonly pushViewedRoute: (route: DiagramRouteState) => void;
}

export function useSharePersistence({
	viewedRoute,
	currentShareBaseline,
	setShareBaseline,
	pushViewedRoute,
}: UseSharePersistenceOptions) {
	const adapter = useDiagramPersistenceAdapter();
	const sessionStore = useContext(DiagramSessionContext);
	if (!sessionStore) {
		throw new Error(
			"useSharePersistence must be used inside DiagramSessionProvider",
		);
	}
	const [isSharing, setIsSharing] = useState(false);
	const [shareLoadError, setShareLoadError] = useState<string | null>(null);

	useEffect(() => {
		const shareId = viewedRoute.shareId;
		if (shareId === null || currentShareBaseline?.shareId === shareId) return;

		let cancelled = false;
		const hasDirtyDraft =
			viewedRoute.isDirty && adapter.getDraft(shareId) !== null;
		if (!hasDirtyDraft) {
			sessionStore.getState().hydrateDiagram(emptyDiagram);
		}

		void readValidatedSharePayload(adapter, shareId)
			.then((payload) => {
				if (cancelled) return;
				if (!hasDirtyDraft) {
					sessionStore
						.getState()
						.hydrateDiagram(diagramFromSchemaPayload(payload));
				}
				setShareBaseline({ shareId, payload });
				if (!hasDirtyDraft) {
					adapter.clearDraft(shareId);
				}
				setShareLoadError(null);
			})
			.catch((error) => {
				if (cancelled) return;
				setShareLoadError(
					error instanceof Error ? error.message : "Unable to load this Share.",
				);
			});

		return () => {
			cancelled = true;
		};
	}, [
		adapter,
		currentShareBaseline?.shareId,
		sessionStore,
		setShareBaseline,
		viewedRoute.isDirty,
		viewedRoute.shareId,
	]);

	const handleShare = useCallback(async () => {
		setIsSharing(true);
		try {
			const baseline = await saveDiagramSessionShare({
				adapter,
				sessionStore,
			});
			if (viewedRoute.shareId !== null) {
				adapter.clearDraft(viewedRoute.shareId);
			}
			adapter.clearDraft(baseline.shareId);
			setShareBaseline(baseline);
			pushViewedRoute({ shareId: baseline.shareId, isDirty: false });
			setShareLoadError(null);

			const shareUrl = new URL(
				`/s/${baseline.shareId}`,
				window.location.origin,
			).toString();
			try {
				await navigator.clipboard.writeText(shareUrl);
				toast.success("Share link copied to clipboard.");
			} catch {
				toast.success("Share created.", { description: shareUrl });
			}
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Unable to share this schema.",
			);
		} finally {
			setIsSharing(false);
		}
	}, [
		adapter,
		pushViewedRoute,
		sessionStore,
		setShareBaseline,
		viewedRoute.shareId,
	]);

	return {
		isSharing,
		shareLoadError,
		handleShare,
	};
}
