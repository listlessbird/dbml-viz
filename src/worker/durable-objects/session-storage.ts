import type {
	DiagramPositions,
	ParseDiagnostic,
	SessionBaseline,
	SessionSnapshot,
	SessionState,
	SharedStickyNote,
} from "./session-types.ts";

export const makeSnapshot = (s: SessionState): SessionSnapshot => ({
	source: s.source,
	positions: s.positions,
	notes: s.notes,
	diagnostics: s.diagnostics,
	tableCount: s.parsedTableCount,
	refCount: s.parsedRefCount,
	baseline: s.baseline ? { shareId: s.baseline.shareId } : null,
	updatedAt: s.updatedAt,
});

const STORAGE_KEYS = [
	"source", "positions", "notes", "diagnostics",
	"parsedTableCount", "parsedRefCount", "baseline",
	"createdAt", "updatedAt", "lastActivityAt",
] as const;

export class SessionStorage {
	private cache: SessionState | null = null;

	constructor(private readonly storage: DurableObjectStorage) {}

	get cached(): SessionState | null {
		return this.cache;
	}

	async load(): Promise<SessionState | null> {
		if (this.cache) return this.cache;

		const createdAt = await this.storage.get<number>("createdAt");
		if (createdAt === undefined) return null;

		const values = await this.storage.get<unknown>(STORAGE_KEYS as unknown as string[]);

		this.cache = {
			source: (values.get("source") as string) ?? "",
			positions: (values.get("positions") as DiagramPositions) ?? {},
			notes: (values.get("notes") as SharedStickyNote[]) ?? [],
			diagnostics: (values.get("diagnostics") as ParseDiagnostic[]) ?? [],
			parsedTableCount: (values.get("parsedTableCount") as number) ?? 0,
			parsedRefCount: (values.get("parsedRefCount") as number) ?? 0,
			baseline: (values.get("baseline") as SessionBaseline | null) ?? null,
			createdAt,
			updatedAt: (values.get("updatedAt") as number) ?? createdAt,
			lastActivityAt: (values.get("lastActivityAt") as number) ?? createdAt,
		};

		return this.cache;
	}

	async save(partial: Partial<SessionState>): Promise<void> {
		if (!this.cache) return;

		Object.assign(this.cache, partial);
		const now = Date.now();
		this.cache.updatedAt = now;
		this.cache.lastActivityAt = now;

		const entries: Record<string, unknown> = {
			updatedAt: this.cache.updatedAt,
			lastActivityAt: this.cache.lastActivityAt,
		};
		for (const key of Object.keys(partial) as (keyof SessionState)[]) {
			entries[key] = this.cache[key];
		}
		await this.storage.put(entries);
	}

	async touch(): Promise<void> {
		if (!this.cache) return;

		this.cache.lastActivityAt = Date.now();
		await this.storage.put({ lastActivityAt: this.cache.lastActivityAt });
	}

	async init(seed: {
		source: string;
		positions: DiagramPositions;
		notes: readonly SharedStickyNote[];
		baseline: SessionBaseline | null;
	}, updatedAt = Date.now()): Promise<SessionState> {
		const now = Date.now();
		this.cache = {
			source: seed.source,
			positions: seed.positions,
			notes: [...seed.notes],
			diagnostics: [],
			parsedTableCount: 0,
			parsedRefCount: 0,
			baseline: seed.baseline,
			createdAt: now,
			updatedAt,
			lastActivityAt: now,
		};

		await this.storage.put({
			source: this.cache.source,
			positions: this.cache.positions,
			notes: this.cache.notes,
			diagnostics: this.cache.diagnostics,
			parsedTableCount: 0,
			parsedRefCount: 0,
			baseline: this.cache.baseline,
			createdAt: now,
			updatedAt: this.cache.updatedAt,
			lastActivityAt: now,
		});

		return this.cache;
	}

	async replaceFromBrowser(seed: {
		source: string;
		positions: DiagramPositions;
		notes: readonly SharedStickyNote[];
		baseline: SessionBaseline | null;
	}, updatedAt: number): Promise<SessionState> {
		const existing = await this.load();
		if (!existing) return this.init(seed, updatedAt);

		const now = Date.now();
		this.cache = {
			...existing,
			source: seed.source,
			positions: seed.positions,
			notes: [...seed.notes],
			diagnostics: [],
			parsedTableCount: 0,
			parsedRefCount: 0,
			baseline: seed.baseline,
			updatedAt,
			lastActivityAt: now,
		};

		await this.storage.put({
			source: this.cache.source,
			positions: this.cache.positions,
			notes: this.cache.notes,
			diagnostics: this.cache.diagnostics,
			parsedTableCount: this.cache.parsedTableCount,
			parsedRefCount: this.cache.parsedRefCount,
			baseline: this.cache.baseline,
			updatedAt,
			lastActivityAt: now,
		});

		return this.cache;
	}

	async clear(): Promise<void> {
		await this.storage.deleteAll();
		this.cache = null;
	}
}
