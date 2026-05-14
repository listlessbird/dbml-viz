import { useMemo, useState } from "react";

import { CopyButton } from "@/components/agent-connectivity/CopyButton";
import { cn } from "@/lib/utils";
import {
        AGENT_CLIENTS,
        type AgentClient,
        type AgentClientId,
} from "@/lib/agent-client-snippets";
import { brandForClient, iconForClient } from "./client-brands";

interface ClientConfigSnippetProps {
        readonly endpoint: string;
}

const KEY_PATTERN = /(".*?"\s*:)/g;
const STRING_PATTERN = /("[^"]*")/g;
const COMMENT_PATTERN = /(\/\/[^\n]*|#[^\n]*)/g;

interface HighlightedSegment {
        readonly text: string;
        readonly className?: string;
}

function highlightSnippet(
        source: string,
        language: AgentClient["snippetLanguage"],
): readonly HighlightedSegment[] {
        const segments: HighlightedSegment[] = [];
        const remaining = source;
        const regex =
                language === "json"
                        ? new RegExp(`${COMMENT_PATTERN.source}|${KEY_PATTERN.source}|${STRING_PATTERN.source}`, "g")
                        : new RegExp(`${COMMENT_PATTERN.source}|${STRING_PATTERN.source}`, "g");

        let lastIndex = 0;
        for (const match of remaining.matchAll(regex)) {
                const matchStart = match.index ?? 0;
                if (matchStart > lastIndex) {
                        segments.push({ text: remaining.slice(lastIndex, matchStart) });
                }
                const matched = match[0];
                const isComment = matched.startsWith("//") || matched.startsWith("#");
                const isKey = !isComment && matched.includes(":") && language === "json";
                segments.push({
                        text: matched,
                        className: isComment
                                ? "text-(--gray-500)"
                                : isKey
                                        ? "text-[oklch(0.77_0.09_230)]"
                                        : "text-[oklch(0.8_0.08_100)]",
                });
                lastIndex = matchStart + matched.length;
        }
        if (lastIndex < remaining.length) {
                segments.push({ text: remaining.slice(lastIndex) });
        }
        return segments;
}

export function ClientConfigSnippet({ endpoint }: ClientConfigSnippetProps) {
        const [activeId, setActiveId] = useState<AgentClientId>("claude-code");
        const activeClient = useMemo(
                () => AGENT_CLIENTS.find((client) => client.id === activeId) ?? AGENT_CLIENTS[0],
                [activeId],
        );
        const snippet = useMemo(
                () => activeClient.buildSnippet(endpoint),
                [activeClient, endpoint],
        );
        const segments = useMemo(
                () => highlightSnippet(snippet, activeClient.snippetLanguage),
                [snippet, activeClient.snippetLanguage],
        );

        return (
                <div className="flex min-w-0 flex-col gap-1.5">
                        <label className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-(--gray-500)">
                                Add to your agent
                        </label>
                        <div className="flex gap-0.5 border-b border-(--gray-200)">
                                {AGENT_CLIENTS.map((client) => {
                                        const isActive = client.id === activeId;
                                        const brand = brandForClient(client.label);
                                        const icon = iconForClient(client.label);

                                        return (
                                                <button
                                                        key={client.id}
                                                        type="button"
                                                        className={cn(
                                                                "-mb-px cursor-pointer border-0 bg-transparent px-2.5 py-1.5 text-[11px] font-medium transition-colors flex items-center gap-1.5",
                                                                isActive
                                                                        ? "border-b-2 text-(--gray-900)"
                                                                        : "border-b-2 border-transparent text-(--gray-500) hover:text-(--gray-700)",
                                                        )}
                                                        style={isActive ? { borderBottomColor: brand.dot } : undefined}
                                                        aria-pressed={isActive}
                                                        onClick={() => setActiveId(client.id)}
                                                >
                                                        <img
                                                                src={icon}
                                                                alt=""
                                                                className="size-3.5 object-contain"
                                                        />
                                                        {client.label}
                                                </button>
                                        );
                                })}
                        </div>
                        <div className="relative min-w-0">
                                <pre className="m-0 max-h-44 overflow-x-auto overflow-y-auto bg-(--gray-900) p-2.5 font-mono text-[11px] leading-[1.55] text-[oklch(0.91_0.02_75)]">
                                        {segments.map((segment, index) => (
                                                <span key={index} className={segment.className}>
                                                        {segment.text}
                                                </span>
                                        ))}
                                </pre>
                                <div className="absolute right-1 top-1">
                                        <CopyButton value={snippet} tone="ghost" label="Copy" />
                                </div>
                        </div>
                </div>
        );
}
