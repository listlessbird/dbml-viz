/// <reference types="vitest/config" />

import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

const isTest = process.env.VITEST === "true";

export default defineConfig({
	dev: {
		sourcemap: { js: false },
	},
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src/react-app", import.meta.url)),
			"@tabler/icons-react": fileURLToPath(
				new URL("./src/react-app/lib/tabler-icons.ts", import.meta.url),
			),
			"@tabler-icon": fileURLToPath(
				new URL("./node_modules/@tabler/icons-react/dist/esm/icons", import.meta.url),
			),
		},
	},
	plugins: isTest
		? [react(), tailwindcss()]
		: [
				react(),
				tailwindcss(),
				cloudflare({
					configPath: "./wrangler.json",
					auxiliaryWorkers: [{ configPath: "./wrangler.parser.json" }],
				}),
			],
	build: {
		rollupOptions: {
			output: {
				manualChunks(id) {
					if (id.includes("node_modules/react-dom/") || id.includes("node_modules/react/")) {
						return "react-vendor";
					}
					if (id.includes("node_modules/@xyflow/")) {
						return "xyflow";
					}
					if (id.includes("node_modules/@codemirror/")) {
						return "codemirror";
					}
				},
			},
		},
	},
	worker: {
		format: "es",
	},
	test: {
		include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
		environment: "jsdom",
		setupFiles: ["./test/react-app/setup.ts"],
		restoreMocks: true,
		clearMocks: true,
	},
});
