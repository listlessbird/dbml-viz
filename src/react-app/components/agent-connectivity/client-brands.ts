export interface ClientBrand {
	/** Light mode: pill background */
	bg: string;
	/** Light mode: pill background on hover */
	bgHover: string;
	/** Light mode: pill border */
	border: string;
	/** Light mode: pill text */
	text: string;
	/** Light mode: dot color */
	dot: string;
	/** Dark mode overrides */
	dark: {
		bg: string;
		bgHover: string;
		border: string;
		text: string;
		dot: string;
	};
}

export const BRAND_CLAUDE: ClientBrand = {
	bg: "oklch(0.955 0.035 45)",
	bgHover: "oklch(0.935 0.05 45)",
	border: "oklch(0.72 0.13 45)",
	text: "oklch(0.35 0.12 40)",
	dot: "oklch(0.62 0.16 45)",
	dark: {
		bg: "oklch(0.22 0.06 40)",
		bgHover: "oklch(0.27 0.08 40)",
		border: "oklch(0.50 0.12 42)",
		text: "oklch(0.88 0.06 45)",
		dot: "oklch(0.70 0.14 45)",
	},
};

export const BRAND_CURSOR: ClientBrand = {
	bg: "oklch(0.96 0.006 250)",
	bgHover: "oklch(0.94 0.01 250)",
	border: "oklch(0.72 0.015 250)",
	text: "oklch(0.25 0.02 250)",
	dot: "oklch(0.45 0.02 250)",
	dark: {
		bg: "oklch(0.22 0.012 250)",
		bgHover: "oklch(0.27 0.018 250)",
		border: "oklch(0.42 0.018 250)",
		text: "oklch(0.90 0.01 250)",
		dot: "oklch(0.62 0.015 250)",
	},
};

export const BRAND_CODEX: ClientBrand = {
	bg: "oklch(0.955 0.03 275)",
	bgHover: "oklch(0.935 0.05 275)",
	border: "oklch(0.65 0.16 275)",
	text: "oklch(0.32 0.16 275)",
	dot: "oklch(0.55 0.20 275)",
	dark: {
		bg: "oklch(0.22 0.07 275)",
		bgHover: "oklch(0.27 0.09 275)",
		border: "oklch(0.48 0.15 275)",
		text: "oklch(0.88 0.05 275)",
		dot: "oklch(0.65 0.18 275)",
	},
};

export const BRAND_ANTIGRAVITY: ClientBrand = {
	bg: "oklch(0.955 0.03 200)",
	bgHover: "oklch(0.935 0.045 200)",
	border: "oklch(0.62 0.14 220)",
	text: "oklch(0.30 0.10 220)",
	dot: "oklch(0.55 0.16 200)",
	dark: {
		bg: "oklch(0.22 0.06 210)",
		bgHover: "oklch(0.27 0.08 210)",
		border: "oklch(0.48 0.12 215)",
		text: "oklch(0.88 0.04 200)",
		dot: "oklch(0.62 0.14 200)",
	},
};

export const BRAND_MCP: ClientBrand = {
	bg: "oklch(0.965 0.005 260)",
	bgHover: "oklch(0.94 0.008 260)",
	border: "oklch(0.78 0.01 260)",
	text: "oklch(0.30 0.02 260)",
	dot: "oklch(0.55 0.02 260)",
	dark: {
		bg: "oklch(0.22 0.015 260)",
		bgHover: "oklch(0.27 0.02 260)",
		border: "oklch(0.42 0.02 260)",
		text: "oklch(0.88 0.015 260)",
		dot: "oklch(0.60 0.02 260)",
	},
};

export function brandForClient(name: string): ClientBrand {
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
