import type { ButtonHTMLAttributes } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";
import type { SessionStatus } from "@/types/session";

export type SessionPillTone = "light" | "dark";

interface SessionStatusPillProps
	extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
	readonly status: SessionStatus;
	readonly label: string;
	readonly hint?: string;
	readonly kbd?: string;
	readonly tone?: SessionPillTone;
	readonly active?: boolean;
}

const baseClasses =
	"shrink-0 inline-flex h-6 items-center gap-1.5 border px-2 text-[11px] font-medium leading-none whitespace-nowrap select-none transition-[background-color,border-color,color] duration-[120ms]";

const lightTones: Record<SessionStatus, string> = {
	offline:
		"border-[var(--gray-300)] bg-[var(--paper)] text-[var(--gray-700)] hover:bg-[var(--gray-100)]",
	connecting:
		"border-[oklch(0.825_0.07_255)] bg-[oklch(0.965_0.014_255)] text-[oklch(0.38_0.14_260)]",
	live: "border-[oklch(0.825_0.09_155)] bg-[oklch(0.965_0.025_155)] text-[oklch(0.255_0.09_155)] hover:bg-[oklch(0.95_0.03_155)]",
	reconnecting:
		"border-[oklch(0.82_0.08_60)] bg-[oklch(0.97_0.025_60)] text-[oklch(0.47_0.14_60)]",
	ended:
		"border-[oklch(0.86_0.04_25)] bg-[oklch(0.975_0.014_25)] text-[var(--crimson-700)]",
};

const darkTones: Record<SessionStatus, string> = {
	offline:
		"border-white/[0.14] bg-[var(--gray-800)] text-[var(--gray-100)] hover:border-white/25 hover:bg-[var(--gray-700)]",
	connecting:
		"border-[oklch(0.38_0.14_260)] bg-[oklch(0.225_0.08_260)] text-[oklch(0.91_0.038_255)]",
	live: "border-[oklch(0.5_0.14_155)] bg-[oklch(0.225_0.06_155)] text-[oklch(0.91_0.04_155)] hover:bg-[oklch(0.27_0.07_155)]",
	reconnecting:
		"border-[oklch(0.58_0.15_60)] bg-[oklch(0.225_0.07_60)] text-[oklch(0.91_0.045_60)]",
	ended:
		"border-[oklch(0.55_0.18_25)] bg-[oklch(0.225_0.06_25)] text-[oklch(0.9_0.05_25)]",
};

const dotTones: Record<SessionStatus, { light: string; dark: string }> = {
	offline: { light: "bg-[var(--gray-400)]", dark: "bg-[var(--gray-400)]" },
	connecting: {
		light: "bg-[oklch(0.38_0.14_260)]",
		dark: "bg-[oklch(0.68_0.12_255)]",
	},
	live: {
		light: "bg-[oklch(0.5_0.14_155)] text-[oklch(0.5_0.14_155)]",
		dark: "bg-[oklch(0.7_0.15_155)] text-[oklch(0.7_0.15_155)]",
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

const dotAnimationClass: Record<SessionStatus, string> = {
	offline: "",
	connecting: "acnx-dot-pulse",
	live: "acnx-dot-halo relative",
	reconnecting: "acnx-dot-pulse-fast",
	ended: "",
};

export const SessionStatusPill = forwardRef<
	HTMLButtonElement,
	SessionStatusPillProps
>(function SessionStatusPill(
	{
		status,
		label,
		hint,
		kbd,
		tone = "light",
		active = false,
		className,
		type = "button",
		...rest
	},
	ref,
) {
	const toneClass = tone === "dark" ? darkTones[status] : lightTones[status];
	const dotColor = dotTones[status][tone];
	const isInteractive = typeof rest.onClick === "function";

	return (
		<button
			ref={ref}
			type={type}
			className={cn(
				baseClasses,
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
			{...rest}
		>
			<span
				aria-hidden="true"
				className={cn(
					"size-1.5 shrink-0 rounded-full",
					dotColor,
					dotAnimationClass[status],
				)}
			/>
			<span className="inline-flex items-center gap-1.5">
				<span>{label}</span>
				{hint ? (
					<span className="font-mono text-[10.5px] opacity-80">{hint}</span>
				) : null}
			</span>
			{kbd ? (
				<span
					className={cn(
						"ml-1 inline-flex h-4 items-center border px-1 font-mono text-[10px] tracking-tight",
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
