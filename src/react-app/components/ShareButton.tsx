import { IconLoader, IconShare2 } from "@tabler/icons-react";

interface ShareButtonProps {
	readonly isSharing: boolean;
	readonly onShare: () => void;
}

export function ShareButton({ isSharing, onShare }: ShareButtonProps) {
	return (
		<button
			type="button"
			className="inline-flex items-center gap-2 border-l border-border bg-sidebar-primary px-3 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
			onClick={onShare}
			disabled={isSharing}
		>
			{isSharing ? (
				<IconLoader className="size-4 animate-spin" />
			) : (
				<IconShare2 className="size-4" />
			)}
			{isSharing ? "Sharing..." : "Share"}
		</button>
	);
}
