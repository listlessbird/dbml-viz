import {
	parseSchemaSource,
	type ParseResult,
	type ParseSchemaSourceFn,
} from "@/schema-source/parse-schema-source";

export interface SchemaSourceParserAdapterOptions {
	readonly parser?: ParseSchemaSourceFn;
	readonly debounceMs?: number;
	readonly onResult: (result: ParseResult) => void;
}

export interface SchemaSourceParserAdapter {
	readonly schedule: (source: string) => void;
	readonly dispose: () => void;
}

const DEFAULT_DEBOUNCE_MS = 300;

export function createSchemaSourceParserAdapter({
	parser,
	debounceMs = DEFAULT_DEBOUNCE_MS,
	onResult,
}: SchemaSourceParserAdapterOptions): SchemaSourceParserAdapter {
	let timer: ReturnType<typeof setTimeout> | null = null;
	let generation = 0;
	let disposed = false;

	const clearPendingTimer = () => {
		if (timer === null) return;
		clearTimeout(timer);
		timer = null;
	};

	return {
		schedule(source) {
			generation += 1;
			const requestGeneration = generation;
			clearPendingTimer();

			if (source.trim().length === 0) {
				return;
			}

			timer = setTimeout(() => {
				timer = null;
				void parseSchemaSource(source, { parser }).then((result) => {
					if (disposed || requestGeneration !== generation) return;
					onResult(result);
				});
			}, debounceMs);
		},
		dispose() {
			disposed = true;
			generation += 1;
			clearPendingTimer();
		},
	};
}
