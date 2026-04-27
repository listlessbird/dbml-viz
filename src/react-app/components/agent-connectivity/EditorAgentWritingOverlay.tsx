import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import type { AgentWritingState } from "@/types/session-activity";

interface EditorAgentWritingOverlayProps {
	readonly writing: AgentWritingState;
	readonly onComplete: () => void;
	readonly className?: string;
}

const MAX_TYPED_CHARS = 320;
const MIN_CHAR_DELAY_MS = 10;
const CHAR_DELAY_JITTER_MS = 22;
const LINE_PAUSE_MS = 60;

function buildPlan(source: string): {
	readonly slice: string;
	readonly remainder: string;
	readonly lines: readonly string[];
} {
	const slice = source.length > MAX_TYPED_CHARS ? source.slice(0, MAX_TYPED_CHARS) : source;
	const remainder = source.length > MAX_TYPED_CHARS ? source.slice(MAX_TYPED_CHARS) : "";
	return { slice, remainder, lines: slice.split("\n") };
}

interface PlayState {
	readonly typed: string;
	readonly activeLineIndex: number;
}

export function EditorAgentWritingOverlay({
	writing,
	onComplete,
	className,
}: EditorAgentWritingOverlayProps) {
	const [playState, setPlayState] = useState<PlayState>({
		typed: "",
		activeLineIndex: 0,
	});
	const onCompleteRef = useRef(onComplete);

	useEffect(() => {
		onCompleteRef.current = onComplete;
	}, [onComplete]);

	useEffect(() => {
		const reduceMotion =
			typeof window !== "undefined" &&
			typeof window.matchMedia === "function" &&
			window.matchMedia("(prefers-reduced-motion: reduce)").matches;

		if (reduceMotion) {
			const handle = window.setTimeout(() => onCompleteRef.current(), 200);
			return () => window.clearTimeout(handle);
		}

		let cancelled = false;
		const { slice, remainder } = buildPlan(writing.source);

		const sleep = (ms: number) =>
			new Promise<void>((resolve) => window.setTimeout(resolve, ms));

		const run = async () => {
			let typed = "";
			let activeLineIndex = 0;

			for (let index = 0; index < slice.length; index += 1) {
				if (cancelled) return;
				const char = slice[index];
				typed += char;
				if (char === "\n") {
					activeLineIndex += 1;
					setPlayState({ typed, activeLineIndex });
					await sleep(LINE_PAUSE_MS);
				} else {
					setPlayState({ typed, activeLineIndex });
					await sleep(MIN_CHAR_DELAY_MS + Math.random() * CHAR_DELAY_JITTER_MS);
				}
			}

			if (cancelled) return;
			if (remainder.length > 0) {
				const finalTyped = typed + remainder;
				setPlayState({
					typed: finalTyped,
					activeLineIndex: finalTyped.split("\n").length - 1,
				});
				await sleep(120);
			}
			if (cancelled) return;
			await sleep(160);
			if (cancelled) return;
			onCompleteRef.current();
		};

		void run();
		return () => {
			cancelled = true;
		};
	}, [writing]);

	const lines = playState.typed.split("\n");

	return (
		<div
			className={cn(
				"acnx-tw-gutter pointer-events-none absolute inset-0 z-30 overflow-hidden bg-[var(--gray-900)] text-[oklch(0.91_0.02_75)]",
				className,
			)}
			aria-live="polite"
		>
			<div className="absolute right-2 top-2 z-10 inline-flex items-center gap-1.5 border border-[oklch(0.38_0.14_260)] bg-[oklch(0.225_0.08_260)] px-2 py-0.5 text-[10px] font-medium text-[oklch(0.91_0.038_255)] shadow-[0_4px_12px_-4px_rgba(0,0,0,0.4)]">
				<span
					aria-hidden="true"
					className="size-1.5 rounded-full bg-[oklch(0.7_0.14_255)] acnx-dot-pulse"
				/>
				<span>claude-code</span>
				<code className="font-mono text-[10px] text-[oklch(0.8_0.08_100)]">
					{writing.tool}
				</code>
			</div>
			<pre className="m-0 h-full overflow-auto whitespace-pre p-3 font-mono text-[12px] leading-[1.6]">
				{lines.map((line, index) => {
					const isActive = index === playState.activeLineIndex;
					return (
						<span
							key={index}
							className={cn(
								"-mx-3 block px-3",
								isActive && "acnx-tw-active",
							)}
						>
							{line}
							{isActive ? (
								<span aria-hidden="true" className="acnx-tw-caret align-baseline" />
							) : null}
							{index < lines.length - 1 ? "\n" : null}
						</span>
					);
				})}
			</pre>
		</div>
	);
}
