import { afterEach } from "vitest";

import { useDiagramDraftStore } from "@/store/useDiagramDraftStore";

const initialDraftStoreState = useDiagramDraftStore.getInitialState();

afterEach(() => {
	window.localStorage.clear();
	useDiagramDraftStore.setState(initialDraftStoreState, true);
});
