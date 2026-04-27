import { Fragment, useMemo } from "react";

import { cn } from "@/lib/utils";
import { useAgentActivityStore } from "@/store/useAgentActivityStore";
import type {
	AgentActivityDirection,
	AgentActivityEntry,
	AgentActivitySummaryPart,
} from "@/types/session-activity";

interface AgentActivityLogProps {
	readonly workspaceId: string | null;
	readonly className?: string;
}

const directionGlyph: Record<AgentActivityDirection, string> = {
	in: "↗",
	out: "↘",
	err: "!",
};

const directionToneClass: Record<AgentActivityDirection, string> = {
	in: "text-[oklch(0.38_0.14_260)]",
	out: "text-[oklch(0.5_0.14_155)]",
	err: "text-[var(--crimson-600)]",
};

function formatTimestamp(timestamp: number): string {
	const date = new Date(timestamp);
	return date.toLocaleTimeString([], {
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});
}

function SummaryPart({ part }: { readonly part: AgentActivitySummaryPart }) {
	switch (part.kind) {
		case "code":
			return (
				<code className="rounded-none bg-[var(--gray-100)] px-1 font-mono text-[10.5px] text-[var(--gray-900)]">
					{part.value}
				</code>
			);
		case "strong":
			return <span className="font-semibold text-[var(--gray-900)]">{part.value}</span>;
		case "text":
		default:
			return <span>{part.value}</span>;
	}
}

function ActivityRow({ entry }: { readonly entry: AgentActivityEntry }) {
	return (
		<li className="grid grid-cols-[56px_14px_1fr] items-baseline gap-2 border-b border-[var(--gray-100)] px-3 py-1.5 text-[11px] leading-tight last:border-b-0">
			<span className="font-mono text-[10px] tabular-nums text-[var(--gray-500)]">
				{formatTimestamp(entry.timestamp)}
			</span>
			<span
				aria-hidden="true"
				className={cn("text-center font-mono text-[11px]", directionToneClass[entry.direction])}
			>
				{directionGlyph[entry.direction]}
			</span>
			<span className="text-[var(--gray-700)]">
				<span className="font-semibold text-[var(--gray-900)]">{entry.tool}</span>
				{entry.parts.length > 0 ? (
					<>
						{" "}
						<span className="text-[var(--gray-500)]">·</span>{" "}
						{entry.parts.map((part, index) => (
							<Fragment key={index}>
								<SummaryPart part={part} />
								{index < entry.parts.length - 1 ? " " : null}
							</Fragment>
						))}
					</>
				) : null}
			</span>
		</li>
	);
}

export function AgentActivityLog({ workspaceId, className }: AgentActivityLogProps) {
	const entries = useAgentActivityStore((state) => state.entries);
	const clearEntries = useAgentActivityStore((state) => state.clearEntries);
	const isEmpty = entries.length === 0;
	const subtitle = useMemo(() => workspaceId ?? "workspace pending", [workspaceId]);

	return (
		<div
			className={cn(
				"w-[380px] max-w-[calc(100vw-2rem)] border border-[var(--gray-300)] bg-[var(--paper)] text-[var(--gray-900)] shadow-md",
				className,
			)}
		>
			<header className="flex items-center gap-2 border-b border-[var(--gray-200)] bg-[var(--gray-50)] px-3 py-2">
				<span
					aria-hidden="true"
					className="acnx-dot-halo relative size-1.5 rounded-full bg-[oklch(0.5_0.14_155)] text-[oklch(0.5_0.14_155)]"
				/>
				<span className="text-[12px] font-semibold text-[var(--gray-900)]">Live</span>
				<span className="font-mono text-[11px] text-[var(--gray-500)]">{subtitle}</span>
				<button
					type="button"
					className="ml-auto cursor-pointer border-0 bg-transparent text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--gray-500)] hover:text-[var(--gray-700)] disabled:opacity-50"
					onClick={clearEntries}
					disabled={isEmpty}
				>
					Clear
				</button>
			</header>
			<div className="max-h-[260px] overflow-y-auto">
				{isEmpty ? (
					<p className="px-3 py-6 text-center text-[11px] italic text-[var(--gray-500)]">
						No agent activity yet. Tool calls will appear here.
					</p>
				) : (
					<ul className="m-0 list-none p-0">
						{entries.map((entry) => (
							<ActivityRow key={entry.id} entry={entry} />
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
