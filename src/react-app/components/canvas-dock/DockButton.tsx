import type { ComponentPropsWithoutRef, ComponentType } from "react";
import { forwardRef } from "react";

import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

interface DockButtonProps extends ComponentPropsWithoutRef<"button"> {
	icon: ComponentType<{ className?: string }>;
	label: string;
	shortcut?: string;
	isActive?: boolean;
}

export const DockButton = forwardRef<HTMLButtonElement, DockButtonProps>(
	function DockButton(
		{
			icon: Icon,
			label,
			shortcut,
			isActive,
			title,
			className,
			type = "button",
			...buttonProps
		},
		ref,
	) {
		return (
			<button
				ref={ref}
				type={type}
				title={title ?? label}
				data-active={isActive}
				className={cn(
					"inline-flex min-w-13 flex-col items-center justify-center gap-1 border-r border-border px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground data-[active=true]:bg-muted data-[active=true]:text-foreground last:border-r-0",
					className,
				)}
				{...buttonProps}
			>
				<Icon className="size-3.5" />
				<span className="flex items-center gap-1 leading-none">
					<span className="text-[9px] uppercase tracking-[0.12em]">{label}</span>
					{shortcut ? (
						<Kbd className="h-4 min-w-4 border border-current/25 bg-transparent px-1 text-[8px] font-normal tracking-widest text-current/50">
							{shortcut}
						</Kbd>
					) : null}
				</span>
			</button>
		);
	},
);

DockButton.displayName = "DockButton";
