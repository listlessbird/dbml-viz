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
        "inline-flex shrink-0 items-center gap-1.5 border px-2 text-[11px] font-medium leading-none transition-colors duration-copy cursor-pointer rounded-control disabled:cursor-not-allowed disabled:opacity-50";

const toneClasses: Record<NonNullable<CopyButtonProps["tone"]>, string> = {
        light:
                "h-[var(--dimension-copy-button-light-height)] border-border-strong bg-background text-foreground hover:bg-muted",
        dark: "h-[var(--dimension-copy-button-dark-height)] border-border bg-transparent text-foreground hover:border-border-strong hover:bg-muted/50",
        ghost: "h-[var(--dimension-copy-button-ghost-height)] border-transparent bg-sidebar-accent text-sidebar-foreground hover:bg-sidebar",
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
                                copied && tone === "light" && "text-workspace-status-connected",
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
