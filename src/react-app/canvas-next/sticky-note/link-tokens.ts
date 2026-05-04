export interface StickyNoteLinkRef {
	readonly token: string;
	readonly table: string;
	readonly column?: string;
}

export type LinkValidator = (table: string, column?: string) => boolean;

const LINK_PATTERN = /#([A-Za-z_][\w]*)(?:\.([A-Za-z_][\w]*))?/g;

// Unique refs in source order. When a validator is supplied, unresolved
// `#foo` or `#foo.bar` tokens are dropped — the caller can still render
// them as plain text via splitTextWithTokens.
export const parseLinksFromText = (
	text: string,
	isValid?: LinkValidator,
): StickyNoteLinkRef[] => {
	const seen = new Set<string>();
	const out: StickyNoteLinkRef[] = [];
	for (const match of text.matchAll(LINK_PATTERN)) {
		const [token, table, column] = match;
		if (isValid && !isValid(table, column)) continue;
		const key = column ? `${table}.${column}` : table;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({ token, table, column });
	}
	return out;
};

export type TextSegment =
	| { readonly kind: "text"; readonly value: string }
	| {
			readonly kind: "token";
			readonly value: string;
			readonly table: string;
			readonly column?: string;
	  };

// Split text into alternating text/token segments. Tokens that fail the
// validator become text segments so unresolved `#foo` renders as-is.
export const splitTextWithTokens = (
	text: string,
	isValid?: LinkValidator,
): TextSegment[] => {
	const out: TextSegment[] = [];
	let cursor = 0;
	for (const match of text.matchAll(LINK_PATTERN)) {
		const start = match.index ?? 0;
		const [token, table, column] = match;
		const valid = !isValid || isValid(table, column);
		if (start > cursor) {
			out.push({ kind: "text", value: text.slice(cursor, start) });
		}
		if (valid) {
			out.push({ kind: "token", value: token, table, column });
		} else {
			out.push({ kind: "text", value: token });
		}
		cursor = start + token.length;
	}
	if (cursor < text.length) {
		out.push({ kind: "text", value: text.slice(cursor) });
	}
	return out;
};
