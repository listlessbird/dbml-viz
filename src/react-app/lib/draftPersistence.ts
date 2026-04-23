import type {
	DiagramNode,
	DiagramPositions,
	SchemaPayload,
	SharedStickyNote,
} from "@/types";

const SHARE_PATH_PATTERN = /^\/s\/([A-Za-z0-9_-]+)$/;

export interface DiagramRouteState {
	readonly shareId: string | null;
	readonly isDirty: boolean;
}

interface InitialDraftStateOptions {
	readonly route: DiagramRouteState;
	readonly draft: SchemaPayload | null;
	readonly sampleSource: string;
}

type DraftHydrationOptions = InitialDraftStateOptions;

interface DraftPayloadOptions {
	readonly source: string;
	readonly nodes: readonly DiagramNode[];
	readonly fallbackPositions: DiagramPositions;
	readonly notes: readonly SharedStickyNote[];
}

interface DraftPersistenceOptions {
	readonly route: DiagramRouteState;
	readonly payload: SchemaPayload;
	readonly sampleSource: string;
	readonly baseline: SchemaPayload | null;
	readonly rootBaseline: SchemaPayload | null;
}

export interface DraftHydrationResult {
	readonly source: string;
	readonly positions: DiagramPositions;
	readonly notes: readonly SharedStickyNote[];
	readonly currentShareId: string | null;
	readonly remoteLoadMode: "none" | "blocking" | "background";
	readonly canonicalRoute: DiagramRouteState;
	readonly clearLocalDraftOnRemoteLoad: boolean;
}

export interface DraftPersistenceDecision {
	readonly shouldStoreDraft: boolean;
	readonly shouldClearDraft: boolean;
	readonly nextRoute: DiagramRouteState;
}

export const getDiagramRouteState = (
	pathname: string,
	search: string,
): DiagramRouteState => {
	const shareId = SHARE_PATH_PATTERN.exec(pathname)?.[1] ?? null;
	const params = new URLSearchParams(search);

	return {
		shareId,
		isDirty: shareId !== null && params.get("dirty") === "true",
	};
};

export const createDiagramRouteHref = ({
	shareId,
	isDirty,
}: DiagramRouteState) => {
	if (shareId === null) {
		return "/";
	}

	return isDirty ? `/s/${shareId}?dirty=true` : `/s/${shareId}`;
};

export const isSameDiagramRoute = (
	left: DiagramRouteState,
	right: DiagramRouteState,
) => left.shareId === right.shareId && left.isDirty === right.isDirty;

export const getPositionsFromNodes = (nodes: readonly DiagramNode[]): DiagramPositions =>
	Object.fromEntries(nodes.map((node) => [node.id, node.position]));

const arePositionsEqual = (
	left: DiagramPositions,
	right: DiagramPositions,
) => {
	const leftKeys = Object.keys(left);
	const rightKeys = Object.keys(right);

	if (leftKeys.length !== rightKeys.length) {
		return false;
	}

	for (const key of leftKeys) {
		const leftPosition = left[key];
		const rightPosition = right[key];

		if (
			!rightPosition ||
			leftPosition.x !== rightPosition.x ||
			leftPosition.y !== rightPosition.y
		) {
			return false;
		}
	}

	return true;
};

export const areSharedStickyNotesEqual = (
	left: readonly SharedStickyNote[],
	right: readonly SharedStickyNote[],
	options?: { readonly ignoreDimensions?: boolean },
) => {
	if (left.length !== right.length) {
		return false;
	}

	for (let index = 0; index < left.length; index += 1) {
		const l = left[index];
		const r = right[index];
		if (
			l.id !== r.id ||
			l.x !== r.x ||
			l.y !== r.y ||
			(!options?.ignoreDimensions && (l.width !== r.width || l.height !== r.height)) ||
			l.color !== r.color ||
			l.text !== r.text
		) {
			return false;
		}
	}

	return true;
};

export const areSchemaPayloadsEqual = (
	left: SchemaPayload,
	right: SchemaPayload,
	options?: { readonly ignoreNoteDimensions?: boolean },
) =>
	left.version === right.version &&
	left.source === right.source &&
	arePositionsEqual(left.positions, right.positions) &&
	areSharedStickyNotesEqual(left.notes, right.notes, {
		ignoreDimensions: options?.ignoreNoteDimensions,
	});

export const getInitialDraftState = ({
	route,
	draft,
	sampleSource,
}: InitialDraftStateOptions) => {
	if (route.shareId === null) {
		return {
			source: draft?.source ?? sampleSource,
			positions: draft?.positions ?? {},
			notes: draft?.notes ?? [],
		};
	}

	if (route.isDirty && draft !== null) {
		return {
			source: draft.source,
			positions: draft.positions,
			notes: draft.notes,
		};
	}

	return {
		source: "",
		positions: {},
		notes: [] as readonly SharedStickyNote[],
	};
};

export const getDraftHydrationResult = ({
	route,
	draft,
	sampleSource,
}: DraftHydrationOptions): DraftHydrationResult => {
	if (route.shareId === null) {
		return {
			source: draft?.source ?? sampleSource,
			positions: draft?.positions ?? {},
			notes: draft?.notes ?? [],
			currentShareId: null,
			remoteLoadMode: "none",
			canonicalRoute: route,
			clearLocalDraftOnRemoteLoad: false,
		};
	}

	if (route.isDirty && draft !== null) {
		return {
			source: draft.source,
			positions: draft.positions,
			notes: draft.notes,
			currentShareId: route.shareId,
			remoteLoadMode: "background",
			canonicalRoute: route,
			clearLocalDraftOnRemoteLoad: false,
		};
	}

	return {
		source: "",
		positions: {},
		notes: [],
		currentShareId: route.shareId,
		remoteLoadMode: "blocking",
		canonicalRoute: {
			shareId: route.shareId,
			isDirty: false,
		},
		clearLocalDraftOnRemoteLoad: draft !== null,
	};
};

export const buildDraftPayload = ({
	source,
	nodes,
	fallbackPositions,
	notes,
}: DraftPayloadOptions): SchemaPayload => ({
	source,
	positions: nodes.length > 0 ? getPositionsFromNodes(nodes) : fallbackPositions,
	notes,
	version: 3,
});

export const resolveDraftPersistence = ({
	route,
	payload,
	sampleSource,
	baseline,
	rootBaseline,
}: DraftPersistenceOptions): DraftPersistenceDecision => {
	if (route.shareId === null) {
		const sampleBaseline =
			rootBaseline ??
			({
				source: sampleSource,
				positions: {},
				notes: [],
				version: 3,
			} satisfies SchemaPayload);
		const shouldClearRootDraft = areSchemaPayloadsEqual(payload, sampleBaseline, {
			ignoreNoteDimensions: true,
		});

		return {
			shouldStoreDraft: !shouldClearRootDraft,
			shouldClearDraft: shouldClearRootDraft,
			nextRoute: route,
		};
	}

	if (baseline === null) {
		return {
			shouldStoreDraft: route.isDirty,
			shouldClearDraft: false,
			nextRoute: route,
		};
	}

	const nextRoute = {
		shareId: route.shareId,
		isDirty: !areSchemaPayloadsEqual(payload, baseline),
	} satisfies DiagramRouteState;

	return {
		shouldStoreDraft: nextRoute.isDirty,
		shouldClearDraft: !nextRoute.isDirty,
		nextRoute,
	};
};
