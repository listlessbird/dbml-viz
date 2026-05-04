import { IconLoader, IconShare2 } from "@tabler/icons-react";

interface ShareButtonProps {
	readonly isSharing: boolean;
	readonly onShare: () => void;
}

export function ShareButton({ isSharing, onShare }: ShareButtonProps) {
	return (
		<button
			type="button"
			className="inline-flex h-6 items-center gap-1.5 border-l border-border bg-sidebar-primary px-2.5 text-[11px] font-medium leading-none text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
			onClick={onShare}
			disabled={isSharing}
		>
			{isSharing ? (
				<IconLoader className="size-3 animate-spin" />
			) : (
				<IconShare2 className="size-3" />
			)}
			<span>{isSharing ? "Sharing..." : "Share"}</span>
		</button>
	);
}
