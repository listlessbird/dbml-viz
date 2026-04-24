import type { SessionPointer } from "@/types/session";

const SESSION_POINTER_KEY = "dbml-viz:session-pointer";
const MAX_POINTER_AGE_MS = 60 * 60 * 1000;

const isSessionPointer = (value: unknown): value is SessionPointer => {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.sessionId === "string" &&
		(candidate.routeShareId === null || typeof candidate.routeShareId === "string") &&
		typeof candidate.routeIsDirty === "boolean" &&
		typeof candidate.createdAt === "number"
	);
};

export const readSessionPointer = (): SessionPointer | null => {
	try {
		const raw = window.localStorage.getItem(SESSION_POINTER_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw);
		if (!isSessionPointer(parsed)) return null;
		if (Date.now() - parsed.createdAt > MAX_POINTER_AGE_MS) {
			window.localStorage.removeItem(SESSION_POINTER_KEY);
			return null;
		}
		return parsed;
	} catch {
		return null;
	}
};

export const writeSessionPointer = (pointer: SessionPointer): void => {
	window.localStorage.setItem(SESSION_POINTER_KEY, JSON.stringify(pointer));
};

export const clearSessionPointer = (sessionId?: string): void => {
	const current = readSessionPointer();
	if (sessionId && current && current.sessionId !== sessionId) return;
	window.localStorage.removeItem(SESSION_POINTER_KEY);
};
