import type { ButtonHTMLAttributes, CSSProperties } from "react";
import { forwardRef, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import type { WorkspaceStatus } from "@/types/workspace";

type WorkspacePillTone = "light" | "dark";

/** Brand color palette for a client — derived from their icon's dominant color. */
interface ClientBrand {
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

interface WorkspaceStatusPillProps
	extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
	readonly status: WorkspaceStatus;
	readonly label: string;
	readonly hint?: string;
	readonly kbd?: string;
	readonly tone?: WorkspacePillTone;
	readonly active?: boolean;
	readonly clientInfo?: {
		readonly name: string;
		readonly ver?: string | null;
		readonly icon?: string;
		readonly iconSlug?: string;
	};
}

const baseClasses =
	"shrink-0 inline-flex h-7 items-center justify-center gap-1.5 border text-[11px] font-medium leading-none select-none transition-all duration-150 ease max-w-[180px] rounded-none overflow-hidden active:scale-[0.97]";

const lightTones: Record<WorkspaceStatus, string> = {
	offline:
		"border-[var(--gray-300)] bg-[var(--paper)] text-[var(--gray-700)] hover:bg-[var(--gray-100)]",
	connecting:
		"border-[oklch(0.825_0.07_255)] bg-[oklch(0.965_0.014_255)] text-[oklch(0.38_0.14_260)]",
	live: "", // handled dynamically per-client brand
	reconnecting:
		"border-[oklch(0.82_0.08_60)] bg-[oklch(0.97_0.025_60)] text-[oklch(0.47_0.14_60)]",
	ended:
		"border-[oklch(0.86_0.04_25)] bg-[oklch(0.975_0.014_25)] text-[var(--crimson-700)]",
};

const darkTones: Record<WorkspaceStatus, string> = {
	offline:
		"border-white/[0.14] bg-[var(--gray-800)] text-[var(--gray-100)] hover:border-white/25 hover:bg-[var(--gray-700)]",
	connecting:
		"border-[oklch(0.38_0.14_260)] bg-[oklch(0.225_0.08_260)] text-[oklch(0.91_0.038_255)]",
	live: "", // handled dynamically per-client brand
	reconnecting:
		"border-[oklch(0.58_0.15_60)] bg-[oklch(0.225_0.07_60)] text-[oklch(0.91_0.045_60)]",
	ended:
		"border-[oklch(0.55_0.18_25)] bg-[oklch(0.225_0.06_25)] text-[oklch(0.9_0.05_25)]",
};

const dotTones: Record<WorkspaceStatus, { light: string; dark: string }> = {
	offline: { light: "bg-[var(--gray-400)]", dark: "bg-[var(--gray-400)]" },
	connecting: {
		light: "bg-[oklch(0.38_0.14_260)]",
		dark: "bg-[oklch(0.68_0.12_255)]",
	},
	live: {
		// overridden by brand dot color when live
		light: "",
		dark: "",
	},
	reconnecting: {
		light: "bg-[oklch(0.58_0.15_60)]",
		dark: "bg-[oklch(0.78_0.15_60)]",
	},
	ended: {
		light: "bg-[var(--crimson-500)]",
		dark: "bg-[oklch(0.625_0.17_25)]",
	},
};

const dotAnimationClass: Record<WorkspaceStatus, string> = {
	offline: "",
	connecting: "acnx-dot-pulse",
	live: "acnx-dot-halo relative",
	reconnecting: "acnx-dot-pulse-fast",
	ended: "",
};

/* ─── Per-client brand palettes ─────────────────────────────────────── */

// Claude Code — warm terracotta (#D97757, hue ≈ 45)
const BRAND_CLAUDE: ClientBrand = {
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

// Cursor — monochrome/dark icon (currentColor), hue ≈ 250 (cool neutral)
const BRAND_CURSOR: ClientBrand = {
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

// Codex (OpenAI) — purple-blue gradient (#B1A7FF → #7A9DFF → #3941FF, hue ≈ 275)
const BRAND_CODEX: ClientBrand = {
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

// Antigravity — vibrant multicolor, dominant blue-green (#3186FF + #00B95C, hue ≈ 200)
const BRAND_ANTIGRAVITY: ClientBrand = {
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

// MCP — neutral (uses currentColor in icon, keep slate)
const BRAND_MCP: ClientBrand = {
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

function brandForClient(name: string): ClientBrand {
	const n = name.toLowerCase();
	if (n.includes("claude")) return BRAND_CLAUDE;
	if (n.includes("cursor")) return BRAND_CURSOR;
	if (n.includes("codex")) return BRAND_CODEX;
	if (n.includes("antigravity")) return BRAND_ANTIGRAVITY;
	return BRAND_MCP;
}

const SAMPLE_CLIENTS = [
	{ name: "Claude Code", ver: "0.45.2", icon: "/cc.svg" },
	{ name: "Cursor", ver: "0.42", icon: "/cursor.svg" },
	{ name: "Codex", ver: "1.0", icon: "/codex.svg" },
	{ name: "Antigravity", ver: "0.1", icon: "/antigravity.svg" },
	{ name: "MCP client", ver: null, icon: "/mcp.svg" },
];

export const WorkspaceStatusPill = forwardRef<
	HTMLButtonElement,
	WorkspaceStatusPillProps
>(function WorkspaceStatusPill(
	{
		status,
		label,
		hint,
		kbd,
		tone = "light",
		active = false,
		clientInfo,
		className,
		type = "button",
		style,
		...rest
	},
	ref,
) {
	const isInteractive = typeof rest.onClick === "function";

	const [randomClient] = useState(
		() => SAMPLE_CLIENTS[Math.floor(Math.random() * SAMPLE_CLIENTS.length)],
	);

	const clientName = clientInfo?.name || randomClient.name;
	const clientVer = clientInfo?.ver ?? randomClient.ver;
	const clientIcon =
		clientInfo?.icon ||
		(clientInfo?.iconSlug
			? `https://unpkg.com/@lobehub/icons-static-svg@latest/icons/${clientInfo.iconSlug}.svg`
			: randomClient.icon);

	const brand = useMemo(() => brandForClient(clientName), [clientName]);

	// Build inline style + classes for the live state
	const liveStyle = useMemo((): CSSProperties | undefined => {
		if (status !== "live") return undefined;
		const b = tone === "dark" ? brand.dark : brand;
		return {
			backgroundColor: b.bg,
			borderColor: b.border,
			color: b.text,
			boxShadow:
				tone === "dark"
					? `inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 0.5px ${b.border}`
					: `inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(0,0,0,0.06), 0 0 0 0.5px ${b.border}`,
		};
	}, [status, tone, brand]);

	const liveHoverStyle = useMemo((): string | undefined => {
		if (status !== "live") return undefined;
		const b = tone === "dark" ? brand.dark : brand;
		return `background-color: ${b.bgHover}`;
	}, [status, tone, brand]);

	const toneClass =
		status === "live"
			? "" // inline styles handle it
			: tone === "dark"
				? darkTones[status]
				: lightTones[status];

	const dotColor =
		status === "live" ? "" : dotTones[status][tone];

	// Dot style for brand-colored live dot
	const liveDotStyle = useMemo((): CSSProperties | undefined => {
		if (status !== "live") return undefined;
		const b = tone === "dark" ? brand.dark : brand;
		return { backgroundColor: b.dot, color: b.dot };
	}, [status, tone, brand]);

	return (
		<button
			ref={ref}
			type={type}
			className={cn(
				baseClasses,
				status === "live" ? "pl-1 pr-2.5" : "px-2.5",
				toneClass,
				isInteractive
					? "cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-current/30"
					: "cursor-default pointer-events-none",
				active && "ring-1 ring-current/40",
				className,
			)}
			aria-pressed={active || undefined}
			data-status={status}
			data-tone={tone}
			style={{ ...style, ...liveStyle }}
			onMouseEnter={
				liveHoverStyle && isInteractive
					? (e) => {
							e.currentTarget.setAttribute("style", `${e.currentTarget.getAttribute("style") ?? ""}; ${liveHoverStyle}`);
						}
					: undefined
			}
			onMouseLeave={
				liveStyle && isInteractive
					? (e) => {
							// Reset to base live style
							const s = e.currentTarget.style;
							const b = tone === "dark" ? brand.dark : brand;
							s.backgroundColor = b.bg;
						}
					: undefined
			}
			{...rest}
		>
			{status === "live" ? (
				<>
					<span
						className={cn(
							"inline-flex items-center justify-center size-[18px] shrink-0 border mr-0.5",
							tone === "dark"
								? "border-white/18 bg-white/8"
								: "border-current/12 bg-current/[0.06]",
						)}
					>
						<img
							src={clientIcon}
							alt={clientName}
							width={14}
							height={14}
							className="block size-3.5 shrink-0 object-contain"
						/>
					</span>
					<span className="leading-none truncate min-w-0 font-medium">
						{clientName}
					</span>
					{clientVer ? (
						<span className="font-mono text-[9.5px] leading-none shrink-0 border-l border-current/12 text-current/65 pl-1.5 ml-0.5 select-none">
							{clientVer}
						</span>
					) : null}
					<span
						aria-hidden="true"
						className={cn(
							"size-1.5 shrink-0 rounded-full ml-1",
							dotAnimationClass[status],
						)}
						style={liveDotStyle}
					/>
				</>
			) : (
				<>
					<span
						aria-hidden="true"
						className={cn(
							"size-1.5 shrink-0 rounded-full",
							dotColor,
							dotAnimationClass[status],
						)}
					/>
					<span className="inline-flex items-baseline gap-1.5 leading-none truncate min-w-0">
						<span className="leading-none truncate min-w-0">{label}</span>
						{hint ? (
							<span className="font-mono text-[10.5px] leading-none opacity-80 shrink-0">
								{hint}
							</span>
						) : null}
					</span>
				</>
			)}
			{kbd ? (
				<span
					className={cn(
						"ml-1 inline-flex h-4 items-center justify-center border px-1 font-mono text-[10px] leading-none tracking-tight shrink-0",
						tone === "dark"
							? "border-white/15 bg-black/30 text-[var(--gray-300)]"
							: "border-[var(--gray-200)] bg-[var(--gray-100)] text-[var(--gray-500)]",
					)}
				>
					{kbd}
				</span>
			) : null}
		</button>
	);
});


