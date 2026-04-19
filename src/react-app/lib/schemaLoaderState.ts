import type { DiagramNodeSize, DiagramPositions } from "@/types";

export interface SchemaLoaderState {
	readonly source: string;
	readonly shareSeedPositions: DiagramPositions;
	readonly isLoadingShare: boolean;
	readonly shareLoadError: string | null;
	readonly nodeMeasurements: Record<string, DiagramNodeSize>;
}

export type SchemaLoaderAction =
	| {
				type: "replace-schema";
				source: string;
				positions: DiagramPositions;
				isLoadingShare: boolean;
				shareLoadError: string | null;
		  }
	| { type: "start-blocking-load" }
	| { type: "finish-blocking-load-error"; message: string }
	| { type: "set-source"; source: string }
	| { type: "set-share-seed-positions"; positions: DiagramPositions }
	| { type: "set-share-load-error"; message: string | null }
	| { type: "prune-node-measurements"; nodeIds: readonly string[] }
	| { type: "record-node-measurement"; nodeId: string; size: DiagramNodeSize };

export const createInitialSchemaLoaderState = ({
	initialSource,
	initialPositions,
	initialIsLoading,
}: {
	readonly initialSource: string;
	readonly initialPositions: DiagramPositions;
	readonly initialIsLoading: boolean;
}): SchemaLoaderState => ({
	source: initialSource,
	shareSeedPositions: initialPositions,
	isLoadingShare: initialIsLoading,
	shareLoadError: null,
	nodeMeasurements: {},
});

export const schemaLoaderReducer = (
	state: SchemaLoaderState,
	action: SchemaLoaderAction,
): SchemaLoaderState => {
	switch (action.type) {
		case "replace-schema":
			return {
				source: action.source,
				shareSeedPositions: action.positions,
				isLoadingShare: action.isLoadingShare,
				shareLoadError: action.shareLoadError,
				nodeMeasurements: {},
			};
		case "start-blocking-load":
			return {
				...state,
				isLoadingShare: true,
				shareLoadError: null,
				nodeMeasurements: {},
			};
		case "finish-blocking-load-error":
			return {
				source: "",
				shareSeedPositions: {},
				isLoadingShare: false,
				shareLoadError: action.message,
				nodeMeasurements: {},
			};
		case "set-source":
			return state.source === action.source
				? state
				: {
							...state,
							source: action.source,
						};
		case "set-share-seed-positions":
			return {
				...state,
				shareSeedPositions: action.positions,
			};
		case "set-share-load-error":
			return state.shareLoadError === action.message
				? state
				: {
						...state,
						shareLoadError: action.message,
					};
		case "prune-node-measurements": {
			const allowedNodeIds = new Set(action.nodeIds);
			const entries = Object.entries(state.nodeMeasurements);
			const survivors = entries.filter(([nodeId]) => allowedNodeIds.has(nodeId));

			if (survivors.length === entries.length) {
				return state;
			}

			return {
				...state,
				nodeMeasurements: Object.fromEntries(survivors),
			};
		}
		case "record-node-measurement": {
			const previous = state.nodeMeasurements[action.nodeId];
			if (
				previous &&
				previous.width === action.size.width &&
				previous.height === action.size.height
			) {
				return state;
			}

			return {
				...state,
				nodeMeasurements: {
					...state.nodeMeasurements,
					[action.nodeId]: action.size,
				},
			};
		}
	}
};
