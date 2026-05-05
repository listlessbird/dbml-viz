import { IconCheck, IconCopy } from "@tabler/icons-react";
import type { ButtonHTMLAttributes } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

interface CopyButtonProps
        extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "onClick"> {
        readonly value: string;
        readonly label?: string;
        readonly copiedLabel?: string;
        readonly tone?: "light" | "dark" | "ghost";
}

const baseClasses =
        "inline-flex shrink-0 items-center gap-1.5 border px-2 text-[11px] font-medium leading-none transition-colors duration-[120ms] cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

const toneClasses: Record<NonNullable<CopyButtonProps["tone"]>, string> = {
        light:
                "h-[28px] border-[var(--gray-300)] bg-[var(--paper)] text-[var(--gray-700)] hover:bg-[var(--gray-100)]",
        dark: "h-[24px] border-white/15 bg-transparent text-[var(--gray-100)] hover:border-white/30 hover:bg-white/5",
        ghost: "h-[22px] border-transparent bg-[var(--gray-800)] text-[oklch(0.91_0.02_75)] hover:bg-[var(--gray-700)]",
};

export function CopyButton({
        value,
        label = "Copy",
        copiedLabel = "Copied",
        tone = "light",
        className,
        type = "button",
        ...rest
}: CopyButtonProps) {
        const [copied, setCopied] = useState(false);
        const timerRef = useRef<number | null>(null);

        useEffect(() => {
                return () => {
                        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
                };
        }, []);

        const handleCopy = useCallback(async () => {
                try {
                        await navigator.clipboard.writeText(value);
                        setCopied(true);
                        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
                        timerRef.current = window.setTimeout(() => setCopied(false), 1600);
                } catch {
                        toast.error("Unable to copy to clipboard.");
                }
        }, [value]);

        return (
                <button
                        type={type}
                        className={cn(
                                baseClasses,
                                toneClasses[tone],
                                copied && tone === "light" && "text-[oklch(0.38_0.13_155)]",
                                className,
                        )}
                        onClick={() => void handleCopy()}
                        {...rest}
                >
                        {copied ? (
                                <IconCheck className="size-3" />
                        ) : (
                                <IconCopy className="size-3" />
                        )}
                        <span>{copied ? copiedLabel : label}</span>
                </button>
        );
}
