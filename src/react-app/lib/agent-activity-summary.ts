import type { AgentActivitySummaryPart } from "@/types/session-activity";

const text = (value: string): AgentActivitySummaryPart => ({ kind: "text", value });
const code = (value: string): AgentActivitySummaryPart => ({ kind: "code", value });
const strong = (value: string): AgentActivitySummaryPart => ({
	kind: "strong",
	value,
});

export const summary = { text, code, strong };

export const pluralize = (count: number, singular: string, plural?: string): string =>
	`${count} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;

export const truncateList = (
	values: readonly string[],
	max: number,
): readonly string[] => {
	if (values.length <= max) return values;
	const head = values.slice(0, max);
	return [...head, `+${values.length - max} more`];
};
