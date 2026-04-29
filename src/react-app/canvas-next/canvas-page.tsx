import { CanvasRuntimeProvider } from "@/canvas-next/canvas-runtime-provider";
import { CanvasNextCanvas } from "@/canvas-next/canvas";
import { DiagramSessionProvider } from "@/diagram-session/diagram-session-provider";

export function CanvasNextPage() {
	return (
		<DiagramSessionProvider>
			<CanvasRuntimeProvider>
				<main
					data-testid="canvas-next-shell"
					className="flex h-screen min-h-0 flex-col bg-background text-foreground"
				>
					<header className="flex h-12 shrink-0 items-center border-b border-border px-4">
						<div className="min-w-0">
							<h1 className="truncate text-sm font-semibold">dbml-viz</h1>
							<p className="truncate text-xs text-muted-foreground">
								Canvas Next
							</p>
						</div>
					</header>
					<section className="min-h-0 flex-1">
						<CanvasNextCanvas />
					</section>
				</main>
			</CanvasRuntimeProvider>
		</DiagramSessionProvider>
	);
}
