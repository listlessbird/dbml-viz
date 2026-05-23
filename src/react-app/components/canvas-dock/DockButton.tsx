import type { ComponentPropsWithoutRef, ComponentType } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

interface DockButtonProps extends ComponentPropsWithoutRef<"button"> {
	icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
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
				aria-pressed={isActive === undefined ? undefined : isActive}
				className={cn(
					"group/tool relative inline-flex size-[var(--dimension-canvas-toolbar-button)] shrink-0 items-center justify-center rounded-toolbar-button border-0 bg-transparent p-0 text-foreground outline-none transition-[background,color,opacity] duration-fast ease-standard hover:bg-toolbar-hover focus-visible:ring-[var(--focus-ring-width)] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-40 data-[active=true]:bg-toolbar-active data-[active=true]:text-toolbar-active-foreground",
					className,
				)}
				{...buttonProps}
			>
				<Icon className="size-[18px]" aria-hidden />
				<span className="sr-only">{label}</span>
				{shortcut ? (
					<span
						aria-hidden="true"
						className={cn(
							"pointer-events-none absolute right-[5px] bottom-1 font-mono text-[9px] leading-none tracking-normal transition-colors duration-fast ease-standard",
							isActive
								? "text-toolbar-active-foreground"
								: "text-toolbar-shortcut group-hover/tool:text-toolbar-shortcut-hover",
						)}
					>
						{shortcut}
					</span>
				) : null}
			</button>
		);
	},
);

DockButton.displayName = "DockButton";
