import type { DiagramPositions } from "@/types";

export interface SchemaLoaderState {
	readonly source: string;
	readonly shareSeedPositions: DiagramPositions;
	readonly isLoadingShare: boolean;
	readonly shareLoadError: string | null;
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
	| { type: "set-share-load-error"; message: string | null };

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
			};
		case "start-blocking-load":
			return {
				...state,
				isLoadingShare: true,
				shareLoadError: null,
			};
		case "finish-blocking-load-error":
			return {
				source: "",
				shareSeedPositions: {},
				isLoadingShare: false,
				shareLoadError: action.message,
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
	}
};
