import type { DiagramNode, DiagramPositions, SchemaPayload } from "@/types";

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
}

interface DraftPersistenceOptions {
	readonly route: DiagramRouteState;
	readonly payload: SchemaPayload;
	readonly sampleSource: string;
	readonly baseline: SchemaPayload | null;
}

export interface DraftHydrationResult {
	readonly source: string;
	readonly positions: DiagramPositions;
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

export const areSchemaPayloadsEqual = (
	left: SchemaPayload,
	right: SchemaPayload,
) =>
	left.version === right.version &&
	left.source === right.source &&
	arePositionsEqual(left.positions, right.positions);

export const getInitialDraftState = ({
	route,
	draft,
	sampleSource,
}: InitialDraftStateOptions) => {
	if (route.shareId === null) {
		return {
			source: draft?.source ?? sampleSource,
			positions: draft?.positions ?? {},
		};
	}

	if (route.isDirty && draft !== null) {
		return {
			source: draft.source,
			positions: draft.positions,
		};
	}

	return {
		source: "",
		positions: {},
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
			currentShareId: route.shareId,
			remoteLoadMode: "background",
			canonicalRoute: route,
			clearLocalDraftOnRemoteLoad: false,
		};
	}

	return {
		source: "",
		positions: {},
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
}: DraftPayloadOptions): SchemaPayload => ({
	source,
	positions: nodes.length > 0 ? getPositionsFromNodes(nodes) : fallbackPositions,
	version: 2,
});

export const resolveDraftPersistence = ({
	route,
	payload,
	sampleSource,
	baseline,
}: DraftPersistenceOptions): DraftPersistenceDecision => {
	if (route.shareId === null) {
		const shouldClearRootDraft =
			payload.source === sampleSource && Object.keys(payload.positions).length === 0;

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
