interface SourceFocusTarget {
	readonly tableName: string;
	readonly columnName: string | null;
}

const REGEX_ESCAPE_PATTERN = /[.*+?^${}()|[\]\\]/g;

const escapeForRegex = (raw: string) =>
	raw.replace(REGEX_ESCAPE_PATTERN, "\\$&");

const buildTableRegex = (tableName: string) => {
	const escaped = escapeForRegex(tableName);
	return new RegExp(
		String.raw`\b(?:CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?|Table)\s+` +
			String.raw`(?:[\w"\x60.]+\.)?` +
			String.raw`["\x60]?` +
			escaped +
			String.raw`["\x60]?`,
		"i",
	);
};

const findColumnInSlice = (slice: string, columnName: string): number => {
	const escaped = escapeForRegex(columnName);
	const re = new RegExp(
		String.raw`(?:^|[\s,(])["\x60]?` + escaped + String.raw`["\x60]?\b`,
		"m",
	);
	const match = slice.match(re);
	if (!match || match.index === undefined) return -1;
	const offset = match.index;
	const head = match[0];
	const nameOffset = head.indexOf(columnName);
	return offset + (nameOffset >= 0 ? nameOffset : 0);
};

export function findSourceFocusPosition(
	doc: string,
	target: SourceFocusTarget,
): number | null {
	if (target.tableName.length === 0) return null;
	const tableRegex = buildTableRegex(target.tableName);
	const tableMatch = doc.match(tableRegex);
	if (!tableMatch || tableMatch.index === undefined) return null;
	const tableStart = tableMatch.index;
	const headLength = tableMatch[0].length;

	if (target.columnName === null) {
		return tableStart;
	}

	const sliceEnd = Math.min(doc.length, tableStart + headLength + 8000);
	const slice = doc.slice(tableStart + headLength, sliceEnd);
	const offsetInSlice = findColumnInSlice(slice, target.columnName);
	if (offsetInSlice === -1) {
		return tableStart;
	}
	return tableStart + headLength + offsetInSlice;
}
