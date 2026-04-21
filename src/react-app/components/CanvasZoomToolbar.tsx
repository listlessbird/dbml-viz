import {
	IconFocus2,
	IconHandMove,
	IconMinus,
	IconPlus,
} from "@tabler/icons-react";
import { memo } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";

interface CanvasZoomToolbarProps {
	readonly zoom: number;
	readonly isPanModeEnabled: boolean;
	readonly onZoomIn: () => void;
	readonly onZoomOut: () => void;
	readonly onFitView: () => void;
	readonly onTogglePanMode: () => void;
}

export const CanvasZoomToolbar = memo(function CanvasZoomToolbar({
	zoom,
	isPanModeEnabled,
	onZoomIn,
	onZoomOut,
	onFitView,
	onTogglePanMode,
}: CanvasZoomToolbarProps) {
	return (
		<div className="pointer-events-none absolute bottom-4 left-4 z-10">
			<div className="pointer-events-auto overflow-hidden bg-background/96 text-foreground shadow-[0_18px_38px_color-mix(in_oklab,var(--foreground)_12%,transparent)] backdrop-blur-sm">
				<ButtonGroup className="overflow-hidden">
					<Button
						type="button"
						title="Zoom out"
						aria-label="Zoom out"
						variant="outline"
						size="icon-lg"
						onClick={onZoomOut}
					>
						<IconMinus className="size-4" />
					</Button>
					<ButtonGroupText className="min-w-16 justify-center border-border bg-background/96 px-3 text-sm text-muted-foreground">
						{Math.round(zoom * 100)}%
					</ButtonGroupText>
					<Button
						type="button"
						title="Zoom in"
						aria-label="Zoom in"
						variant="outline"
						size="icon-lg"
						onClick={onZoomIn}
					>
						<IconPlus className="size-4" />
					</Button>
					<Button
						type="button"
						title="Fit view"
						aria-label="Fit view"
						variant="outline"
						size="icon-lg"
						onClick={onFitView}
					>
						<IconFocus2 className="size-4" />
					</Button>
					<Button
						type="button"
						title={
							isPanModeEnabled
								? "Pan mode is on. Left-drag pans until you turn it off."
								: "Pan mode is off. Drag on the canvas to select tables."
						}
						aria-label="Toggle pan mode"
						aria-pressed={isPanModeEnabled}
						variant={isPanModeEnabled ? "default" : "outline"}
						size="icon-lg"
						onClick={onTogglePanMode}
					>
						<IconHandMove className="size-4" />
					</Button>
				</ButtonGroup>
			</div>
		</div>
	);
});
