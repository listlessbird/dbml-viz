import type { Diagram } from "@/diagram-session/diagram-session-context";
import {
	emptyDiagram,
	type DiagramSessionStore,
} from "@/diagram-session/diagram-session-store";
import {
	resolveDraftPersistence,
	type DiagramRouteState,
	type DraftPersistenceDecision,
} from "@/lib/draftPersistence";
import { SAMPLE_SCHEMA_SOURCE } from "@/lib/sample-dbml";
import { parseSchemaPayload } from "@/lib/schema-payload";
import type { SchemaPayload } from "@/types";
import type { DiagramPersistenceAdapter } from "@/canvas-next/diagram-persistence-adapter";

export interface ShareBaseline {
	readonly shareId: string;
	readonly payload: SchemaPayload;
}

export const diagramFromSchemaPayload = (payload: SchemaPayload): Diagram => ({
	source: payload.source,
	parsedSchema: emptyDiagram.parsedSchema,
	tablePositions: payload.positions,
	stickyNotes: payload.notes,
});

export async function readValidatedSharePayload(
	adapter: DiagramPersistenceAdapter,
	shareId: string,
): Promise<SchemaPayload> {
	const rawPayload = await adapter.loadShare(shareId);
	const payload = parseSchemaPayload(rawPayload);
	if (!payload) {
		throw new Error("Shared schema payload is invalid.");
	}
	return payload;
}

export interface LoadShareIntoDiagramSessionOptions {
	readonly adapter: DiagramPersistenceAdapter;
	readonly sessionStore: DiagramSessionStore;
	readonly shareId: string;
}

export async function loadShareIntoDiagramSession({
	adapter,
	sessionStore,
	shareId,
}: LoadShareIntoDiagramSessionOptions): Promise<SchemaPayload> {
	const payload = await readValidatedSharePayload(adapter, shareId);
	sessionStore.getState().hydrateDiagram(diagramFromSchemaPayload(payload));
	return payload;
}

export interface SaveDiagramSessionShareOptions {
	readonly adapter: DiagramPersistenceAdapter;
	readonly sessionStore: DiagramSessionStore;
}

export async function saveDiagramSessionShare({
	adapter,
	sessionStore,
}: SaveDiagramSessionShareOptions): Promise<ShareBaseline> {
	const payload = sessionStore.getState().toSchemaPayload();
	const result = await adapter.saveShare(payload);
	return {
		shareId: result.id,
		payload,
	};
}

export interface ResolveShareRouteDecisionOptions {
	readonly route: DiagramRouteState;
	readonly payload: SchemaPayload;
	readonly baseline: SchemaPayload | null;
}

export function resolveShareRouteDecision({
	route,
	payload,
	baseline,
}: ResolveShareRouteDecisionOptions): DraftPersistenceDecision {
	return resolveDraftPersistence({
		route,
		payload,
		sampleSource: SAMPLE_SCHEMA_SOURCE,
		baseline,
		rootBaseline: null,
	});
}
