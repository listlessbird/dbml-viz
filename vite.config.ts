/// <reference types="vitest/config" />

import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

const isTest = process.env.VITEST === "true";

export default defineConfig({
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src/react-app", import.meta.url)),
		},
	},
	plugins: isTest ? [react(), tailwindcss()] : [react(), tailwindcss(), cloudflare()],
	test: {
		include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
		environment: "jsdom",
		setupFiles: ["./test/react-app/setup.ts"],
		restoreMocks: true,
		clearMocks: true,
	},
});
