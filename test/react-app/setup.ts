import { afterEach } from "vitest";

import { useDiagramDraftStore } from "@/store/useDiagramDraftStore";
import { useDiagramUiStore } from "@/store/useDiagramUiStore";

const initialDraftStoreState = useDiagramDraftStore.getInitialState();
const initialUiStoreState = useDiagramUiStore.getInitialState();

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
	.IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
	window.localStorage.clear();
	useDiagramDraftStore.setState(initialDraftStoreState, true);
	useDiagramUiStore.setState(initialUiStoreState, true);
});
