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
});

const STORAGE_KEYS = [
	"source", "positions", "notes", "diagnostics",
	"parsedTableCount", "parsedRefCount", "baseline",
	"createdAt", "lastActivityAt",
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
			lastActivityAt: (values.get("lastActivityAt") as number) ?? createdAt,
		};

		return this.cache;
	}

	async save(partial: Partial<SessionState>): Promise<void> {
		if (!this.cache) return;

		Object.assign(this.cache, partial);
		this.cache.lastActivityAt = Date.now();

		const entries: Record<string, unknown> = { lastActivityAt: this.cache.lastActivityAt };
		for (const key of Object.keys(partial) as (keyof SessionState)[]) {
			entries[key] = this.cache[key];
		}
		await this.storage.put(entries);
	}

	async init(seed: {
		source: string;
		positions: DiagramPositions;
		notes: readonly SharedStickyNote[];
		baseline: SessionBaseline | null;
	}): Promise<SessionState> {
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
			lastActivityAt: now,
		});

		return this.cache;
	}

	async clear(): Promise<void> {
		await this.storage.deleteAll();
		this.cache = null;
	}
}
