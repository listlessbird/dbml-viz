export interface ClientBrandClasses {
	readonly bg: string;
	readonly bgHover: string;
	readonly border: string;
	readonly foreground: string;
	readonly dotBg: string;
	readonly dotText: string;
	readonly borderBottom: string;
}

export const BRAND_CLAUDE: ClientBrandClasses = {
	bg: "bg-brand-claude",
	bgHover: "hover:bg-brand-claude-hover",
	border: "border-brand-claude-border",
	foreground: "text-brand-claude-foreground",
	dotBg: "bg-brand-claude-dot",
	dotText: "text-brand-claude-dot",
	borderBottom: "border-b-brand-claude-dot",
};

export const BRAND_CURSOR: ClientBrandClasses = {
	bg: "bg-brand-cursor",
	bgHover: "hover:bg-brand-cursor-hover",
	border: "border-brand-cursor-border",
	foreground: "text-brand-cursor-foreground",
	dotBg: "bg-brand-cursor-dot",
	dotText: "text-brand-cursor-dot",
	borderBottom: "border-b-brand-cursor-dot",
};

export const BRAND_CODEX: ClientBrandClasses = {
	bg: "bg-brand-codex",
	bgHover: "hover:bg-brand-codex-hover",
	border: "border-brand-codex-border",
	foreground: "text-brand-codex-foreground",
	dotBg: "bg-brand-codex-dot",
	dotText: "text-brand-codex-dot",
	borderBottom: "border-b-brand-codex-dot",
};

export const BRAND_ANTIGRAVITY: ClientBrandClasses = {
	bg: "bg-brand-antigravity",
	bgHover: "hover:bg-brand-antigravity-hover",
	border: "border-brand-antigravity-border",
	foreground: "text-brand-antigravity-foreground",
	dotBg: "bg-brand-antigravity-dot",
	dotText: "text-brand-antigravity-dot",
	borderBottom: "border-b-brand-antigravity-dot",
};

export const BRAND_MCP: ClientBrandClasses = {
	bg: "bg-brand-mcp",
	bgHover: "hover:bg-brand-mcp-hover",
	border: "border-brand-mcp-border",
	foreground: "text-brand-mcp-foreground",
	dotBg: "bg-brand-mcp-dot",
	dotText: "text-brand-mcp-dot",
	borderBottom: "border-b-brand-mcp-dot",
};

export function brandForClient(name: string): ClientBrandClasses {
	const n = name.toLowerCase();
	if (n.includes("claude")) return BRAND_CLAUDE;
	if (n.includes("cursor")) return BRAND_CURSOR;
	if (n.includes("codex")) return BRAND_CODEX;
	if (n.includes("antigravity")) return BRAND_ANTIGRAVITY;
	return BRAND_MCP;
}

export function displayNameForClient(clientName: string, title?: string): string {
	return title || clientName;
}

export function iconForClient(clientName: string): string {
	const n = clientName.toLowerCase();
	if (n.includes("claude")) return "/cc.svg";
	if (n.includes("cursor")) return "/cursor.svg";
	if (n.includes("codex")) return "/codex.svg";
	if (n.includes("antigravity")) return "/antigravity.svg";
	return "/mcp.svg";
}
