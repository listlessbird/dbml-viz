import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
	buildDraftPayload,
	type DiagramRouteState,
} from "@/lib/draftPersistence";
import { saveSharedSchema, sharedSchemaQueryKey } from "@/lib/sharing";
import { getSharedStickyNotes } from "@/store/useStickyNotesStore";
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
	const queryClient = useQueryClient();
	const { isPending: isSharing, mutateAsync: saveSharedSchemaMutation } = useMutation({
		mutationFn: saveSharedSchema,
	});

	const handleShare = useCallback(async () => {
		try {
			const payload = buildDraftPayload({
				source,
				nodes,
				fallbackPositions: shareSeedPositions,
				notes: getSharedStickyNotes().filter(
					(note) => note.text.trim().length > 0,
				),
			});
			const result = await saveSharedSchemaMutation(payload);
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
			queryClient.setQueryData(sharedSchemaQueryKey(result.id), payload);
			setShareLoadError(null);
		} catch (error) {
			console.error(error);

			toast.error(
				error instanceof Error ? error.message : "Unable to share this schema.",
			);
		}
	}, [
		clearDraft,
		nodes,
		queryClient,
		saveSharedSchemaMutation,
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
