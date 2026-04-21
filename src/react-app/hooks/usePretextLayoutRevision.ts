import { clearCache } from "@chenglou/pretext";
import { useEffect, useState } from "react";

import { clearTableNodeLayoutCache } from "@/components/table-node/layout";

export function usePretextLayoutRevision(): number {
	const [revision, setRevision] = useState(() =>
		typeof document !== "undefined" && document.fonts.status === "loaded" ? 1 : 0,
	);

	useEffect(() => {
		if (typeof document === "undefined") return;

		let active = true;
		let initialReady = document.fonts.status === "loaded";
		const bump = () => {
			clearCache();
			clearTableNodeLayoutCache();
			setRevision((current) => current + 1);
		};

		if (!initialReady) {
			document.fonts.ready.then(() => {
				if (!active) return;
				initialReady = true;
				bump();
			});
		}

		const handleLoadingDone = () => {
			if (!active || !initialReady) return;
			bump();
		};

		document.fonts.addEventListener?.("loadingdone", handleLoadingDone);
		return () => {
			active = false;
			document.fonts.removeEventListener?.("loadingdone", handleLoadingDone);
		};
	}, []);

	return revision;
}
