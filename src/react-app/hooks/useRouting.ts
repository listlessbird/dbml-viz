import { useCallback, useEffect, useState } from "react";

import {
	createDiagramRouteHref,
	type DiagramRouteState,
	getDiagramRouteState,
	isSameDiagramRoute,
} from "@/lib/draftPersistence";
import type { SchemaPayload } from "@/types";

export function useRouting(initialRoute: DiagramRouteState) {
	const [viewedRoute, setViewedRoute] = useState(initialRoute);
	const [shareBaseline, setShareBaseline] = useState<{
		shareId: string;
		payload: SchemaPayload;
	} | null>(null);

	const currentShareBaseline =
		shareBaseline?.shareId === viewedRoute.shareId ? shareBaseline.payload : null;

	const applyViewedRoute = useCallback(
		(nextRoute: DiagramRouteState, historyMode: "push" | "replace" | "none") => {
			setViewedRoute((currentRoute) => {
				if (isSameDiagramRoute(nextRoute, currentRoute)) {
					return currentRoute;
				}

				const href = createDiagramRouteHref(nextRoute);
				if (historyMode === "push") {
					window.history.pushState({}, "", href);
				} else if (historyMode === "replace") {
					window.history.replaceState({}, "", href);
				}

				return nextRoute;
			});
			setShareBaseline((currentBaseline) =>
				currentBaseline?.shareId === nextRoute.shareId ? currentBaseline : null,
			);
		},
		[],
	);

	useEffect(() => {
		const onPopState = () => {
			applyViewedRoute(
				getDiagramRouteState(window.location.pathname, window.location.search),
				"none",
			);
		};

		window.addEventListener("popstate", onPopState);
		return () => {
			window.removeEventListener("popstate", onPopState);
		};
	}, [applyViewedRoute]);

	const replaceViewedRoute = useCallback(
		(nextRoute: DiagramRouteState) => {
			applyViewedRoute(nextRoute, "replace");
		},
		[applyViewedRoute],
	);

	const pushViewedRoute = useCallback(
		(nextRoute: DiagramRouteState) => {
			applyViewedRoute(nextRoute, "push");
		},
		[applyViewedRoute],
	);

	return {
		viewedRoute,
		shareBaseline,
		currentShareBaseline,
		setShareBaseline,
		replaceViewedRoute,
		pushViewedRoute,
	};
}
