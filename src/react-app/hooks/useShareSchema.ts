import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";

import {
	buildDraftPayload,
	type DiagramRouteState,
} from "@/lib/draftPersistence";
import { saveSharedSchema } from "@/lib/sharing";
import type { DiagramNode, DiagramPositions, SchemaPayload } from "@/types";

interface ShareSchemaOptions {
	readonly source: string;
	readonly nodes: readonly DiagramNode[];
	readonly shareSeedPositions: DiagramPositions;
	readonly viewedRoute: DiagramRouteState;
	readonly clearDraft: (shareId: string | null) => void;
	readonly pushViewedRoute: (route: DiagramRouteState) => void;
	readonly setShareSeedPositions: (positions: DiagramPositions) => void;
	readonly setShareBaseline: Dispatch<
		SetStateAction<{ shareId: string; payload: SchemaPayload } | null>
	>;
	readonly setShareLoadError: (message: string | null) => void;
}

export function useShareSchema({
	source,
	nodes,
	shareSeedPositions,
	viewedRoute,
	clearDraft,
	pushViewedRoute,
	setShareSeedPositions,
	setShareBaseline,
	setShareLoadError,
}: ShareSchemaOptions) {
	const [isSharing, setIsSharing] = useState(false);

	const handleShare = useCallback(async () => {
		setIsSharing(true);

		try {
			const payload = buildDraftPayload({
				source,
				nodes,
				fallbackPositions: shareSeedPositions,
			});
			const result = await saveSharedSchema(payload);
			const nextUrl = new URL(`/s/${result.id}`, window.location.origin).toString();

			const copyAction = {
				label: "Copy again",
				onClick: () => void navigator.clipboard.writeText(nextUrl),
			};

			try {
				await navigator.clipboard.writeText(nextUrl);
				toast.success("Share link copied to clipboard.", {
					action: copyAction,
				});
			} catch {
				toast.success("Share created.", {
					description: nextUrl,
					action: copyAction,
				});
			}

			if (viewedRoute.shareId !== null) {
				clearDraft(viewedRoute.shareId);
			}

			pushViewedRoute({
				shareId: result.id,
				isDirty: false,
			});
			setShareSeedPositions(payload.positions);
			setShareBaseline({
				shareId: result.id,
				payload,
			});
			setShareLoadError(null);
		} catch (error) {
			console.error(error);

			toast.error(
				error instanceof Error ? error.message : "Unable to share this schema.",
			);
		} finally {
			setIsSharing(false);
		}
	}, [
		clearDraft,
		nodes,
		source,
		pushViewedRoute,
		setShareBaseline,
		setShareLoadError,
		setShareSeedPositions,
		shareSeedPositions,
		viewedRoute.shareId,
	]);

	return {
		isSharing,
		handleShare,
	};
}
