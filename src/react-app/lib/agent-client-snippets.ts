export type AgentClientId = "claude-code" | "codex" | "cursor" | "other";

export interface AgentClient {
	readonly id: AgentClientId;
	readonly label: string;
	readonly buildSnippet: (endpoint: string) => string;
	readonly snippetLanguage: "json" | "shell";
	readonly description?: string;
}

const buildClaudeCode = (endpoint: string): string =>
	`// ~/.claude/mcp.json
{
  "mcpServers": {
    "dbml-canvas": {
      "url": "${endpoint}"
    }
  }
}`;

const buildCodex = (endpoint: string): string =>
	`# add to your shell once
codex mcp add dbml-canvas --url ${endpoint}`;

const buildCursor = (endpoint: string): string =>
	`// ~/.cursor/mcp.json
{
  "mcpServers": {
    "dbml-canvas": {
      "url": "${endpoint}"
    }
  }
}`;

const buildGeneric = (endpoint: string): string =>
	`# any MCP-aware client
npx add-mcp ${endpoint} -a codex -a cursor -a claude-code`;

export const AGENT_CLIENTS: readonly AgentClient[] = [
	{
		id: "claude-code",
		label: "Claude Code",
		buildSnippet: buildClaudeCode,
		snippetLanguage: "json",
	},
	{
		id: "codex",
		label: "Codex",
		buildSnippet: buildCodex,
		snippetLanguage: "shell",
	},
	{
		id: "cursor",
		label: "Cursor",
		buildSnippet: buildCursor,
		snippetLanguage: "json",
	},
	{
		id: "other",
		label: "Other",
		buildSnippet: buildGeneric,
		snippetLanguage: "shell",
	},
];

export const findAgentClient = (id: AgentClientId): AgentClient => {
	const match = AGENT_CLIENTS.find((client) => client.id === id);
	if (!match) throw new Error(`Unknown agent client: ${id}`);
	return match;
};

const PLACEHOLDER_ENDPOINT = "https://dbml-viz.dev/api/agent/device-id/mcp";

export const getDisplayEndpoint = (endpoint: string | null): string =>
	endpoint && endpoint.length > 0 ? endpoint : PLACEHOLDER_ENDPOINT;
