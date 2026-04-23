import { useEffect, useMemo, useRef } from "react";

import { buildDraftPayload } from "@/lib/draftPersistence";
import {
	buildSampleStickyNotes,
	isSampleSchemaSource,
} from "@/lib/sample-dbml";
import {
	getSharedStickyNotes,
	useStickyNotesStore,
} from "@/store/useStickyNotesStore";
import type {
	DiagramNode,
	SchemaPayload,
	SharedStickyNote,
} from "@/types";

const areSharedStickyNotesEqual = (
	left: readonly SharedStickyNote[],
	right: readonly SharedStickyNote[],
) => {
	if (left.length !== right.length) {
		return false;
	}

	for (let index = 0; index < left.length; index += 1) {
		const l = left[index];
		const r = right[index];
		if (
			l?.id !== r?.id ||
			l?.x !== r?.x ||
			l?.y !== r?.y ||
			l?.width !== r?.width ||
			l?.height !== r?.height ||
			l?.color !== r?.color ||
			l?.text !== r?.text
		) {
			return false;
		}
	}

	return true;
};

interface UseSampleStickyNotesOptions {
	readonly source: string;
	readonly nodes: readonly DiagramNode[];
	readonly canPersistNodePositions: boolean;
	readonly shareId: string | null;
	readonly getDraft: (shareId: string | null) => SchemaPayload | null;
	readonly requestFitView: (nodeIds?: readonly string[]) => void;
}

export function useSampleStickyNotes({
	source,
	nodes,
	canPersistNodePositions,
	shareId,
	getDraft,
	requestFitView,
}: UseSampleStickyNotesOptions) {
	const managedNotesRef = useRef<readonly SharedStickyNote[] | null>(null);
	const sampleNotes = useMemo(() => {
		if (
			shareId !== null ||
			!isSampleSchemaSource(source) ||
			!canPersistNodePositions ||
			nodes.length === 0 ||
			getDraft(null) !== null
		) {
			return null;
		}

		const nextNotes = buildSampleStickyNotes(nodes);
		return nextNotes.length > 0 ? nextNotes : null;
	}, [canPersistNodePositions, getDraft, nodes, shareId, source]);

	const rootSampleBaseline = useMemo(() => {
		if (sampleNotes === null) {
			return null;
		}

		return buildDraftPayload({
			source,
			nodes,
			fallbackPositions: {},
			notes: sampleNotes,
		});
	}, [nodes, sampleNotes, source]);

	useEffect(() => {
		if (sampleNotes === null) {
			managedNotesRef.current = null;
			return;
		}

		const currentNotes = getSharedStickyNotes();
		const currentManagedNotes = managedNotesRef.current;
		const notesAreManaged =
			currentManagedNotes !== null &&
			areSharedStickyNotesEqual(currentNotes, currentManagedNotes);

		if (currentNotes.length > 0 && !notesAreManaged) {
			managedNotesRef.current = null;
			return;
		}

		managedNotesRef.current = sampleNotes;
		if (areSharedStickyNotesEqual(currentNotes, sampleNotes)) {
			return;
		}

		useStickyNotesStore.getState().hydrate(sampleNotes);
		requestFitView();
	}, [requestFitView, sampleNotes]);

	return { rootSampleBaseline };
}
