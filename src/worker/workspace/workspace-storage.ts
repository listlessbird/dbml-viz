import type {
	DiagramPositions,
	ParseDiagnostic,
	WorkspaceBaseline,
	WorkspaceSnapshot,
	WorkspaceState,
	SharedStickyNote,
} from "./workspace-types.ts";
import { decideWorkspaceAttach, type WorkspaceAttachDecision } from "./workspace-attach.ts";

export const makeSnapshot = (s: WorkspaceState): WorkspaceSnapshot => ({
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

type WorkspaceMutation = Partial<
	Pick<
		WorkspaceState,
		| "source"
		| "positions"
		| "notes"
		| "diagnostics"
		| "parsedTableCount"
		| "parsedRefCount"
		| "baseline"
	>
>;

export class WorkspaceStorage {
	private cache: WorkspaceState | null = null;

	constructor(private readonly storage: DurableObjectStorage) {}

	get cached(): WorkspaceState | null {
		return this.cache;
	}

	async load(): Promise<WorkspaceState | null> {
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
			baseline: (values.get("baseline") as WorkspaceBaseline | null) ?? null,
			createdAt,
			updatedAt: (values.get("updatedAt") as number) ?? createdAt,
			lastActivityAt: (values.get("lastActivityAt") as number) ?? createdAt,
		};

		return this.cache;
	}

	private async saveMutation(partial: WorkspaceMutation): Promise<void> {
		if (!this.cache) return;

		Object.assign(this.cache, partial);
		const now = Date.now();
		this.cache.updatedAt = now;
		this.cache.lastActivityAt = now;

		const entries: Record<string, unknown> = {
			updatedAt: this.cache.updatedAt,
			lastActivityAt: this.cache.lastActivityAt,
		};
		for (const key of Object.keys(partial) as (keyof WorkspaceState)[]) {
			entries[key] = this.cache[key];
		}
		await this.storage.put(entries);
	}

	async saveBrowserMutation(partial: WorkspaceMutation): Promise<void> {
		await this.saveMutation(partial);
	}

	async saveAgentMutation(partial: WorkspaceMutation): Promise<void> {
		await this.saveMutation(partial);
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
		baseline: WorkspaceBaseline | null;
	}, updatedAt = Date.now()): Promise<WorkspaceState> {
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

	private async replaceFromBrowser(seed: {
		source: string;
		positions: DiagramPositions;
		notes: readonly SharedStickyNote[];
		baseline: WorkspaceBaseline | null;
	}, updatedAt: number): Promise<WorkspaceState> {
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

	async attachBrowser(seed: {
		source: string;
		positions: DiagramPositions;
		notes: readonly SharedStickyNote[];
		baseline: WorkspaceBaseline | null;
	}, updatedAt: number): Promise<WorkspaceAttachDecision> {
		const current = await this.load();
		const decision = decideWorkspaceAttach(current, { state: seed, updatedAt });
		if (decision.winner === "remote") {
			await this.touch();
			return decision;
		}

		await this.replaceFromBrowser(decision.state, decision.updatedAt);
		return decision;
	}

	async clear(): Promise<void> {
		await this.storage.deleteAll();
		this.cache = null;
	}
}
