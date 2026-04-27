import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import type { ReconnectState } from "@/types/session-activity";

interface EditorReconnectVeilProps {
	readonly reconnect: ReconnectState;
	readonly className?: string;
}

function useCountdownSeconds(nextDelayMs: number): number {
	const [secondsLeft, setSecondsLeft] = useState(() =>
		Math.max(0, Math.ceil(nextDelayMs / 1000)),
	);

	useEffect(() => {
		if (nextDelayMs <= 0) return;
		const targetMs = Date.now() + nextDelayMs;
		const intervalId = window.setInterval(() => {
			const remaining = Math.max(0, Math.ceil((targetMs - Date.now()) / 1000));
			setSecondsLeft(remaining);
			if (remaining <= 0) window.clearInterval(intervalId);
		}, 250);
		return () => window.clearInterval(intervalId);
	}, [nextDelayMs]);

	return secondsLeft;
}

export function EditorReconnectVeil({
	reconnect,
	className,
}: EditorReconnectVeilProps) {
	const secondsLeft = useCountdownSeconds(reconnect.nextDelayMs);

	const attemptLabel = `attempt ${reconnect.attempt} of ${reconnect.maxAttempts}`;
	const nextLabel = secondsLeft > 0 ? ` · next try in ${secondsLeft}s` : "";

	return (
		<div
			className={cn(
				"pointer-events-auto absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-black/35 backdrop-blur-[0.5px]",
				className,
			)}
			role="status"
			aria-live="polite"
		>
			<span className="text-[12px] font-medium text-[var(--paper)]">
				Reconnecting to session…
			</span>
			<span className="font-mono text-[10px] text-[oklch(0.82_0.08_60)]">
				{attemptLabel}
				{nextLabel}
			</span>
		</div>
	);
}
