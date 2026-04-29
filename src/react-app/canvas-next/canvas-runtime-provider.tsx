import { useEffect, useRef, type PropsWithChildren } from "react";

import { CanvasRuntimeContext } from "@/canvas-next/canvas-runtime-context";
import {
	createCanvasRuntimeStore,
	type CanvasRuntimeStore,
} from "@/canvas-next/canvas-runtime-store";

export function CanvasRuntimeProvider({ children }: PropsWithChildren) {
	const storeRef = useRef<CanvasRuntimeStore | null>(null);

	storeRef.current ??= createCanvasRuntimeStore();

	useEffect(() => {
		const store = storeRef.current;
		return () => {
			store?.getState().dispose();
		};
	}, []);

	return <CanvasRuntimeContext value={storeRef.current}>{children}</CanvasRuntimeContext>;
}
