import type { ButtonHTMLAttributes } from "react";
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
	"shrink-0 inline-flex h-[var(--dimension-status-pill-height)] items-center justify-center gap-1.5 border text-[11px] font-medium leading-none select-none transition-all duration-fast ease-standard max-w-[var(--dimension-status-pill-max-width)] rounded-control overflow-hidden active:scale-[0.97]";

const lightTones: Record<WorkspaceStatus, string> = {
	offline:
		"border-workspace-status-offline-border bg-workspace-status-offline text-workspace-status-offline-foreground hover:bg-workspace-status-offline-hover",
	connecting:
		"border-workspace-status-connecting-border bg-workspace-status-connecting text-workspace-status-connecting-foreground",
	live: "", // handled dynamically per-client brand
	reconnecting:
		"border-workspace-status-reconnecting-border bg-workspace-status-reconnecting text-workspace-status-reconnecting-foreground",
	ended:
		"border-workspace-status-ended-border bg-workspace-status-ended text-workspace-status-ended-foreground",
};

const darkTones: Record<WorkspaceStatus, string> = {
	offline:
		"border-workspace-status-offline-border bg-workspace-status-offline text-workspace-status-offline-foreground hover:bg-workspace-status-offline-hover",
	connecting:
		"border-workspace-status-connecting-border bg-workspace-status-connecting text-workspace-status-connecting-foreground",
	live: "", // handled dynamically per-client brand
	reconnecting:
		"border-workspace-status-reconnecting-border bg-workspace-status-reconnecting text-workspace-status-reconnecting-foreground",
	ended:
		"border-workspace-status-ended-border bg-workspace-status-ended text-workspace-status-ended-foreground",
};

const dotTones: Record<WorkspaceStatus, { light: string; dark: string }> = {
	offline: { light: "bg-workspace-status-offline-dot", dark: "bg-workspace-status-offline-dot" },
	connecting: {
		light: "bg-workspace-status-connecting-dot",
		dark: "bg-workspace-status-connecting-dot",
	},
	live: {
		light: "",
		dark: "",
	},
	reconnecting: {
		light: "bg-workspace-status-reconnecting-dot",
		dark: "bg-workspace-status-reconnecting-dot",
	},
	ended: {
		light: "bg-workspace-status-ended-dot",
		dark: "bg-workspace-status-ended-dot",
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

	const toneClass =
		status === "live"
			? "" // inline styles handle it
			: tone === "dark"
				? darkTones[status]
				: lightTones[status];

	const dotColor =
		status === "live" ? "" : dotTones[status][tone];

	const liveClasses = status === "live"
		? `${brand.border} ${brand.bg} ${brand.foreground} ${brand.bgHover}`
		: "";

	return (
		<button
			ref={ref}
			type={type}
			title={fullClientTitle}
			className={cn(
				baseClasses,
				status === "live" ? "pl-1 pr-2.5" : "px-2.5",
				liveClasses,
				toneClass,
				isInteractive
					? "cursor-pointer focus-visible:outline-none focus-visible:ring-[var(--focus-ring-thin-width)] focus-visible:ring-current/30"
					: "cursor-default pointer-events-none",
				active && "ring-[var(--focus-ring-thin-width)] ring-current/40",
				className,
			)}
			aria-pressed={active || undefined}
			data-status={status}
			data-tone={tone}
			style={style}
			{...rest}
		>
			{status === "live" ? (
				<>
					<span
						className={cn(
							"inline-flex size-[var(--dimension-status-icon-tile)] items-center justify-center shrink-0 border mr-0.5 rounded-control",
							tone === "dark"
								? "border-current/18 bg-current/8"
								: "border-current/12 bg-current/6",
						)}
					>
						<img
							src={clientIcon}
							alt={clientName}
							width={14}
							height={14}
							className="block size-[var(--dimension-status-icon)] shrink-0 object-contain"
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
							"size-[var(--dimension-status-dot)] shrink-0 rounded-full ml-1",
							brand.dotBg,
							brand.dotText,
							dotAnimationClass[status],
						)}
					/>
				</>
			) : (
				<>
					<span
						aria-hidden="true"
						className={cn(
							"size-[var(--dimension-status-dot)] shrink-0 rounded-full",
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
						"ml-1 inline-flex h-[var(--dimension-status-kbd-height)] items-center justify-center border px-1 font-mono text-[10px] leading-none tracking-tight shrink-0 rounded-control",
						tone === "dark"
							? "border-current/15 bg-foreground/10 text-muted-foreground"
							: "border-border bg-muted text-muted-foreground",
					)}
				>
					{kbd}
				</span>
			) : null}
		</button>
	);
});
