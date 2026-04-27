import { useAgentActivityStore } from "@/store/useAgentActivityStore";
import { cn } from "@/lib/utils";

interface EditorTitleStatusProps {
	readonly className?: string;
}

const GLYPH = "⧬"; // ⧬ — used as the "lock/operator" mark

interface ChipDescriptor {
	readonly label: string;
	readonly tone: "navy" | "amber";
}

function buildDescriptor(
	hasWriting: boolean,
	hasReconnect: boolean,
): ChipDescriptor | null {
	if (hasWriting) return { label: "agent writing", tone: "navy" };
	if (hasReconnect) return { label: "locked", tone: "amber" };
	return null;
}

export function EditorTitleStatus({ className }: EditorTitleStatusProps) {
	const writing = useAgentActivityStore((state) => state.writing);
	const reconnect = useAgentActivityStore((state) => state.reconnect);
	const descriptor = buildDescriptor(writing !== null, reconnect !== null);
	if (!descriptor) return null;

	const dotClass =
		descriptor.tone === "navy"
			? "bg-[oklch(0.7_0.14_255)] acnx-dot-pulse"
			: "bg-[oklch(0.78_0.15_60)] acnx-dot-pulse-fast";
	const labelClass =
		descriptor.tone === "navy"
			? "text-[oklch(0.77_0.09_230)]"
			: "text-[oklch(0.7_0.15_60)]";

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em]",
				labelClass,
				className,
			)}
		>
			<span aria-hidden="true" className={cn("size-1.5 rounded-full", dotClass)} />
			<span aria-hidden="true">{GLYPH}</span>
			<span>{descriptor.label}</span>
		</span>
	);
}
