import type { ButtonHTMLAttributes, CSSProperties } from "react";
import { forwardRef, useMemo } from "react";

import { cn } from "@/lib/utils";
import type { McpClientPresence, WorkspaceStatus } from "@/types/workspace";

type WorkspacePillTone = "light" | "dark";

import {
	brandForClient,
	displayNameForClient,
	iconForClient,
} from "./client-brands";

interface WorkspaceStatusPillProps
	extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
	readonly status: WorkspaceStatus;
	readonly label: string;
	readonly hint?: string;
	readonly kbd?: string;
	readonly tone?: WorkspacePillTone;
	readonly active?: boolean;
	readonly mcpClientPresence?: McpClientPresence;
}

const baseClasses =
	"shrink-0 inline-flex h-7 items-center justify-center gap-1.5 border text-[11px] font-medium leading-none select-none transition-all duration-150 ease max-w-[180px] rounded-none overflow-hidden active:scale-[0.97]";

const lightTones: Record<WorkspaceStatus, string> = {
	offline:
		"border-(--gray-300) bg-(--paper) text-(--gray-700) hover:bg-(--gray-100)",
	connecting:
		"border-[oklch(0.825_0.07_255)] bg-[oklch(0.965_0.014_255)] text-[oklch(0.38_0.14_260)]",
	live: "", // handled dynamically per-client brand
	reconnecting:
		"border-[oklch(0.82_0.08_60)] bg-[oklch(0.97_0.025_60)] text-[oklch(0.47_0.14_60)]",
	ended:
		"border-[oklch(0.86_0.04_25)] bg-[oklch(0.975_0.014_25)] text-(--crimson-700)",
};

const darkTones: Record<WorkspaceStatus, string> = {
	offline:
		"border-white/[0.14] bg-(--gray-800) text-(--gray-100) hover:border-white/25 hover:bg-(--gray-700)",
	connecting:
		"border-[oklch(0.38_0.14_260)] bg-[oklch(0.225_0.08_260)] text-[oklch(0.91_0.038_255)]",
	live: "", // handled dynamically per-client brand
	reconnecting:
		"border-[oklch(0.58_0.15_60)] bg-[oklch(0.225_0.07_60)] text-[oklch(0.91_0.045_60)]",
	ended:
		"border-[oklch(0.55_0.18_25)] bg-[oklch(0.225_0.06_25)] text-[oklch(0.9_0.05_25)]",
};

const dotTones: Record<WorkspaceStatus, { light: string; dark: string }> = {
	offline: { light: "bg-(--gray-400)", dark: "bg-(--gray-400)" },
	connecting: {
		light: "bg-[oklch(0.38_0.14_260)]",
		dark: "bg-[oklch(0.68_0.12_255)]",
	},
	live: {
		light: "",
		dark: "",
	},
	reconnecting: {
		light: "bg-[oklch(0.58_0.15_60)]",
		dark: "bg-[oklch(0.78_0.15_60)]",
	},
	ended: {
		light: "bg-(--crimson-500)",
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
		mcpClientPresence = { status: "waiting", clientInfo: null },
		className,
		type = "button",
		style,
		...rest
	},
	ref,
) {
	const isInteractive = typeof rest.onClick === "function";

	const clientInfo = mcpClientPresence.clientInfo;
	const clientName =
		mcpClientPresence.status === "connected" && clientInfo
			? displayNameForClient(clientInfo.name, clientInfo.title)
			: mcpClientPresence.status === "disconnected"
			? "MCP client disconnected"
			: "Waiting for MCP client";
	const clientVer =
		mcpClientPresence.status === "connected" ? clientInfo?.version ?? null : null;
	const clientIcon = clientInfo ? iconForClient(clientInfo.name) : "/mcp.svg";

	const fullClientTitle = clientVer ? `${clientName} ${clientVer}` : clientName;

	const brand = useMemo(() => brandForClient(clientName), [clientName]);

	const buttonStyle = useMemo((): CSSProperties | undefined => {
		if (status !== "live") return undefined;
		const b = tone === "dark" ? brand.dark : brand;
		return {
			...style,
			"--acnx-pill-bg": b.bg,
			"--acnx-pill-bg-hover": b.bgHover,
			"--acnx-pill-border": b.border,
			"--acnx-pill-text": b.text,
			boxShadow:
				tone === "dark"
					? `inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 0.5px ${b.border}`
					: `inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(0,0,0,0.06), 0 0 0 0.5px ${b.border}`,
		} as CSSProperties;
	}, [status, tone, brand, style]);

	const toneClass =
		status === "live"
			? "" // inline styles handle it
			: tone === "dark"
				? darkTones[status]
				: lightTones[status];

	const dotColor =
		status === "live" ? "" : dotTones[status][tone];

	const liveDotStyle = useMemo((): CSSProperties | undefined => {
		if (status !== "live") return undefined;
		const b = tone === "dark" ? brand.dark : brand;
		return { backgroundColor: b.dot, color: b.dot };
	}, [status, tone, brand]);

	return (
		<button
			ref={ref}
			type={type}
			title={fullClientTitle}
			className={cn(
				baseClasses,
				status === "live" ? "pl-1 pr-2.5" : "px-2.5",
				status === "live" &&
					"border-(--acnx-pill-border) bg-(--acnx-pill-bg) text-(--acnx-pill-text) hover:bg-(--acnx-pill-bg-hover)",
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
			style={status === "live" ? buttonStyle : style}
			{...rest}
		>
			{status === "live" ? (
				<>
					<span
						className={cn(
							"inline-flex items-center justify-center size-[18px] shrink-0 border mr-0.5",
							tone === "dark"
								? "border-white/18 bg-white/8"
								: "border-current/12 bg-current/6",
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
							? "border-white/15 bg-black/30 text-(--gray-300)"
							: "border-(--gray-200) bg-(--gray-100) text-(--gray-500)",
					)}
				>
					{kbd}
				</span>
			) : null}
		</button>
	);
});
