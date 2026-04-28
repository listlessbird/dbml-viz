/// <reference lib="webworker" />

import ELK from "elkjs/lib/elk-api.js";

const elk = new ELK({
	workerFactory: () =>
		new Worker(new URL("elkjs/lib/elk-worker.min.js", import.meta.url)),
});

const workerScope = self as DedicatedWorkerGlobalScope;

workerScope.addEventListener("message", (event: MessageEvent<{ graph: unknown }>) => {
	void elk.layout(event.data.graph as never)
		.then((result) => {
			workerScope.postMessage({
				type: "success",
				result,
			});
		})
		.catch((error) => {
			workerScope.postMessage({
				type: "error",
				message: error instanceof Error ? error.message : "Unable to layout diagram.",
			});
		});
});
