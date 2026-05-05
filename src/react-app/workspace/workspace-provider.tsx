import { useContext, useEffect, useRef, type PropsWithChildren } from "react";

import { CanvasRuntimeContext } from "@/canvas-next/canvas-runtime-context";
import { DiagramSessionContext } from "@/diagram-session/diagram-session-context";
import { WorkspaceContext } from "@/workspace/workspace-context";
import {
	createCanvasRuntimeFocusRequester,
	createDiagramSessionWorkspacePatchApplier,
	createDiagramSessionWorkspaceHydrator,
	createWorkspaceStore,
	type WorkspaceStore,
	type WorkspaceStoreAdapters,
} from "@/workspace/workspace-store";
import type { WorkspaceSeed } from "@/types/workspace";

interface WorkspaceProviderProps extends PropsWithChildren {
	readonly getCurrentSeed: () => WorkspaceSeed;
	readonly handleShareResult: (shareId: string) => void;
	readonly adapter?: Partial<WorkspaceStoreAdapters>;
}

export function WorkspaceProvider({
	children,
	getCurrentSeed,
	handleShareResult,
	adapter,
}: WorkspaceProviderProps) {
	const diagramStore = useContext(DiagramSessionContext);
	const runtimeStore = useContext(CanvasRuntimeContext);
	if (!diagramStore) {
		throw new Error("WorkspaceProvider must be mounted inside DiagramSessionProvider");
	}
	if (!runtimeStore) {
		throw new Error("WorkspaceProvider must be mounted inside CanvasRuntimeProvider");
	}

	const seedRef = useRef(getCurrentSeed);
	seedRef.current = getCurrentSeed;

	const storeRef = useRef<WorkspaceStore | null>(null);
	storeRef.current ??= createWorkspaceStore({
		...adapter,
		getCurrentSeed: () => seedRef.current(),
		hydrateSnapshot:
			adapter?.hydrateSnapshot ??
			createDiagramSessionWorkspaceHydrator(diagramStore),
		applyPatch:
			adapter?.applyPatch ??
			createDiagramSessionWorkspacePatchApplier(diagramStore),
		requestFocus:
			adapter?.requestFocus ??
			createCanvasRuntimeFocusRequester(runtimeStore),
		handleShareResult: adapter?.handleShareResult ?? handleShareResult,
	});

	useEffect(() => {
		const store = storeRef.current;
		return () => {
			store?.getState().dispose();
		};
	}, []);

	return (
		<WorkspaceContext value={storeRef.current}>{children}</WorkspaceContext>
	);
}
