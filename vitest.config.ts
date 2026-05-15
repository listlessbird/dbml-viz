import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

const alias = {
	"@": fileURLToPath(new URL("./src/react-app", import.meta.url)),
	"@tabler/icons-react": fileURLToPath(
		new URL("./src/react-app/lib/tabler-icons.ts", import.meta.url),
	),
	"@tabler-icon": fileURLToPath(
		new URL("./node_modules/@tabler/icons-react/dist/esm/icons", import.meta.url),
	),
};

const parserServiceBinding = async (request: Request): Promise<Response> => {
	const payload = (await request.json()) as { id: number; source: string };

	if (payload.source.includes("syntax error")) {
		return Response.json(
			{
				id: payload.id,
				ok: false,
				diagnostics: [
					{
						message: "Expected table body",
						location: { start: { line: 1, column: 7 } },
					},
				],
			},
			{ status: 400 },
		);
	}

	return Response.json({
		id: payload.id,
		ok: true,
		parsed: {
			tables: [
				{
					id: "users",
					name: "users",
					columns: [
						{
							name: "id",
							type: "int",
							pk: true,
							notNull: true,
							unique: true,
							isForeignKey: false,
							isIndexed: true,
						},
					],
					indexes: [],
				},
			],
			refs: [],
			errors: [],
		},
		metadata: { format: "dbml" },
		sourceRanges: null,
	});
};

export default defineConfig({
	test: {
		projects: [
			{
				plugins: [react(), tailwindcss()],
				resolve: { alias },
				test: {
					name: "react-app",
					include: [
						"test/react-app/**/*.test.ts",
						"test/react-app/**/*.test.tsx",
					],
					environment: "jsdom",
					setupFiles: ["./test/react-app/setup.ts"],
					restoreMocks: true,
					clearMocks: true,
				},
			},
			{
				resolve: { alias },
				test: {
					name: "worker-unit",
					include: ["test/worker/*.test.ts"],
					environment: "node",
					restoreMocks: true,
					clearMocks: true,
				},
			},
			{
				resolve: { alias },
				plugins: [
					cloudflareTest({
						wrangler: { configPath: "./wrangler.json" },
						miniflare: {
							serviceBindings: {
								SCHEMA_PARSER: parserServiceBinding,
							},
						},
					}),
				],
				test: {
					name: "worker-runtime",
					include: ["test/worker/runtime/**/*.test.ts"],
					restoreMocks: true,
					clearMocks: true,
				},
			},
		],
	},
});
