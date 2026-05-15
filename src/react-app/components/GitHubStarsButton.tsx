import { useQuery } from "@tanstack/react-query";
import { IconBrandGithub, IconStar } from "@tabler/icons-react";

const REPO = "listlessbird/dbml-viz";
const REPO_URL = `https://github.com/${REPO}`;

async function fetchStarCount(): Promise<number> {
	const response = await fetch(`https://api.github.com/repos/${REPO}`);
	if (!response.ok) {
		throw new Error("Failed to fetch GitHub data");
	}
	const data = (await response.json()) as { stargazers_count: number };
	return data.stargazers_count;
}

function formatStars(count: number): string {
	if (count >= 1000) {
		return `${(count / 1000).toFixed(1)}k`;
	}
	return String(count);
}

export function GitHubStarsButton() {
	const { data: stars, isLoading } = useQuery({
		queryKey: ["github-stars", REPO],
		queryFn: fetchStarCount,
		staleTime: 5 * 60 * 1000, // 5 minutes
		gcTime: 10 * 60 * 1000,
		retry: 1,
	});

	return (
		<a
			href={REPO_URL}
			target="_blank"
			rel="noopener noreferrer"
			id="github-stars-button"
			className="inline-flex h-7 items-center gap-1.5 rounded border border-border bg-muted/60 px-2 text-[11px] font-medium leading-none text-muted-foreground transition-colors hover:border-border/80 hover:bg-muted hover:text-foreground"
			aria-label="View source on GitHub"
		>
			<IconBrandGithub className="size-3.5 shrink-0" />
			<span className="hidden sm:inline">GitHub</span>
			{!isLoading && stars !== undefined && (
				<span className="inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums">
					<IconStar className="size-2.5 shrink-0 fill-current" />
					{formatStars(stars)}
				</span>
			)}
		</a>
	);
}
