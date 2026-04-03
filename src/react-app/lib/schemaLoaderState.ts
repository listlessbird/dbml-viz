import type { DiagramNodeSize, DiagramPositions } from "@/types";

export interface SchemaLoaderState {
	readonly dbml: string;
	readonly shareSeedPositions: DiagramPositions;
	readonly isLoadingShare: boolean;
	readonly shareLoadError: string | null;
	readonly nodeMeasurements: Record<string, DiagramNodeSize>;
}

export type SchemaLoaderAction =
	| {
			type: "replace-schema";
			dbml: string;
			positions: DiagramPositions;
			isLoadingShare: boolean;
			shareLoadError: string | null;
	  }
	| { type: "start-blocking-load" }
	| { type: "finish-blocking-load-error"; message: string }
	| { type: "set-dbml"; dbml: string }
	| { type: "set-share-seed-positions"; positions: DiagramPositions }
	| { type: "set-share-load-error"; message: string | null }
	| { type: "record-node-measurement"; nodeId: string; size: DiagramNodeSize };

export const createInitialSchemaLoaderState = ({
	initialDbml,
	initialPositions,
	initialIsLoading,
}: {
	readonly initialDbml: string;
	readonly initialPositions: DiagramPositions;
	readonly initialIsLoading: boolean;
}): SchemaLoaderState => ({
	dbml: initialDbml,
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
				dbml: action.dbml,
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
				dbml: "",
				shareSeedPositions: {},
				isLoadingShare: false,
				shareLoadError: action.message,
				nodeMeasurements: {},
			};
		case "set-dbml":
			return state.dbml === action.dbml
				? state
				: {
						...state,
						dbml: action.dbml,
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
