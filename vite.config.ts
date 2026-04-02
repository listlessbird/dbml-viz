import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/react-app", import.meta.url)),
    },
  },
  plugins: [react(), tailwindcss(), cloudflare()],
});
