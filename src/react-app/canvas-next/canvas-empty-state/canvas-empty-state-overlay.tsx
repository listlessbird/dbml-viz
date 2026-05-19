import {
	IconAlertTriangle,
	IconCode,
	IconDatabase,
	IconLoader2,
	IconSparkles,
} from "@tabler/icons-react";
import { memo } from "react";

import type { CanvasStateResult } from "@/canvas-next/canvas-empty-state/derive-canvas-state";

interface CanvasEmptyStateOverlayProps {
	readonly state: CanvasStateResult;
	readonly onOpenSchemaSource: () => void;
	readonly onLoadSample: () => void;
	readonly onOpenDiagnostics: () => void;
}

export const CanvasEmptyStateOverlay = memo(function CanvasEmptyStateOverlay({
	state,
	onOpenSchemaSource,
	onLoadSample,
	onOpenDiagnostics,
}: CanvasEmptyStateOverlayProps) {
	if (state.variant === "ready") return null;

	if (state.variant === "layout-pending") {
		return (
			<div
				data-testid="canvas-state-overlay"
				data-variant="layout-pending"
				className="pointer-events-none absolute top-4 left-1/2 z-10 -translate-x-1/2 inline-flex items-center gap-2 rounded-panel border border-border bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-panel backdrop-blur-panel"
			>
				<IconLoader2 className="size-3.5 animate-spin" aria-hidden />
				<span>Arranging tables…</span>
			</div>
		);
	}

	const content = renderContent(state, {
		onOpenSchemaSource,
		onLoadSample,
		onOpenDiagnostics,
	});

	return (
		<div
			data-testid="canvas-state-overlay"
			data-variant={state.variant}
			className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6"
		>
			<div className="pointer-events-auto flex max-w-md flex-col items-center gap-4 rounded-panel border border-border bg-background/95 px-6 py-8 text-center shadow-canvas-popover backdrop-blur-panel">
				{content}
			</div>
		</div>
	);
});

interface OverlayActions {
	readonly onOpenSchemaSource: () => void;
	readonly onLoadSample: () => void;
	readonly onOpenDiagnostics: () => void;
}

function renderContent(
	state: CanvasStateResult,
	{ onOpenSchemaSource, onLoadSample, onOpenDiagnostics }: OverlayActions,
) {
	switch (state.variant) {
		case "empty-source":
			return (
				<>
					<IconCode
						className="size-8 text-muted-foreground"
						aria-hidden
					/>
					<div className="space-y-1">
						<h2 className="text-sm font-semibold text-foreground">
							No schema source yet
						</h2>
						<p className="text-xs text-muted-foreground">
							Paste DBML or SQL to start visualizing your schema.
						</p>
					</div>
					<div className="flex flex-wrap items-center justify-center gap-2">
						<OverlayPrimaryButton onClick={onOpenSchemaSource}>
							Open Schema Source
						</OverlayPrimaryButton>
						<OverlaySecondaryButton onClick={onLoadSample}>
							<IconSparkles className="size-3.5" aria-hidden />
							Load sample schema
						</OverlaySecondaryButton>
					</div>
				</>
			);
		case "invalid-source":
			return (
				<>
					<IconAlertTriangle
						className="size-8 text-destructive"
						aria-hidden
					/>
					<div className="space-y-1">
						<h2 className="text-sm font-semibold text-foreground">
							Schema source has errors
						</h2>
						<p className="text-xs text-muted-foreground">
							{state.diagnosticsCount}{" "}
							{state.diagnosticsCount === 1
								? "diagnostic"
								: "diagnostics"}{" "}
							reported. Fix them to see the diagram.
						</p>
					</div>
					<div className="flex flex-wrap items-center justify-center gap-2">
						<OverlayPrimaryButton onClick={onOpenSchemaSource}>
							Open Schema Source
						</OverlayPrimaryButton>
						<OverlaySecondaryButton onClick={onOpenDiagnostics}>
							Open diagnostics
						</OverlaySecondaryButton>
					</div>
				</>
			);
		case "zero-tables":
			return (
				<>
					<IconDatabase
						className="size-8 text-muted-foreground"
						aria-hidden
					/>
					<div className="space-y-1">
						<h2 className="text-sm font-semibold text-foreground">
							No tables found in schema
						</h2>
						<p className="text-xs text-muted-foreground">
							The schema parsed successfully but contains no tables.
						</p>
					</div>
					<div className="flex flex-wrap items-center justify-center gap-2">
						<OverlayPrimaryButton onClick={onOpenSchemaSource}>
							Open Schema Source
						</OverlayPrimaryButton>
					</div>
				</>
			);
		default:
			return null;
	}
}

function OverlayPrimaryButton({
	children,
	onClick,
}: {
	readonly children: React.ReactNode;
	readonly onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="inline-flex items-center gap-1.5 border border-primary bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
		>
			{children}
		</button>
	);
}

function OverlaySecondaryButton({
	children,
	onClick,
}: {
	readonly children: React.ReactNode;
	readonly onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="inline-flex items-center gap-1.5 border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
		>
			{children}
		</button>
	);
}
