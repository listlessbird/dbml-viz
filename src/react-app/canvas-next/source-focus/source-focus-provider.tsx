import { useEffect, useRef, type PropsWithChildren } from "react";

import { SourceFocusContext } from "@/canvas-next/source-focus/source-focus-context";
import {
	createSourceFocusStore,
	type SourceFocusStore,
} from "@/canvas-next/source-focus/source-focus-store";

export function SourceFocusProvider({ children }: PropsWithChildren) {
	const storeRef = useRef<SourceFocusStore | null>(null);
	storeRef.current ??= createSourceFocusStore();

	useEffect(() => {
		const store = storeRef.current;
		return () => {
			store?.getState().dispose();
		};
	}, []);

	return (
		<SourceFocusContext value={storeRef.current}>{children}</SourceFocusContext>
	);
}
