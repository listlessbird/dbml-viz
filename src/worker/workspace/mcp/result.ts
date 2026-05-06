import { Result } from "better-result";

type WorkspaceMcpSuccessPayload = {
	readonly ok: true;
};

type WorkspaceMcpErrorPayload = {
	readonly ok: false;
	readonly reason: string;
	readonly message: string;
	readonly recovery: string;
};

export type WorkspaceMcpOutcome<
	S extends WorkspaceMcpSuccessPayload,
	E extends WorkspaceMcpErrorPayload,
> = Result<S, E>;

export type WorkspaceMcpToolResult<
	T extends object = Record<string, unknown>,
> = {
	readonly content: { readonly type: "text"; readonly text: string }[];
	readonly structuredContent: T;
	readonly isError?: true;
};

export const toWorkspaceMcpResult = <
	S extends WorkspaceMcpSuccessPayload,
	E extends WorkspaceMcpErrorPayload,
>(
	outcome: WorkspaceMcpOutcome<S, E>,
): WorkspaceMcpToolResult<S | E> => {
	if (Result.isOk(outcome)) {
		return {
			content: [
				{ type: "text", text: JSON.stringify(outcome.value, null, 2) },
			],
			structuredContent: outcome.value,
		};
	}

	return {
		content: [
			{ type: "text", text: JSON.stringify(outcome.error, null, 2) },
		],
		structuredContent: outcome.error,
		isError: true,
	};
};
