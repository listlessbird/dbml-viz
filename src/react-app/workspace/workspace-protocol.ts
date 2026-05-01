import type { ServerWorkspaceMessage } from "@/types/workspace";

export const parseServerWorkspaceMessage = (
	raw: string,
): ServerWorkspaceMessage | null => {
	try {
		const parsed = JSON.parse(raw);
		return parsed && typeof parsed === "object" && "type" in parsed
			? (parsed as ServerWorkspaceMessage)
			: null;
	} catch {
		return null;
	}
};
