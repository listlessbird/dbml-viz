import { StrictMode, lazy, Suspense } from "react";
import type { ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@xyflow/react/dist/style.css";
import "./index.css";
import App from "./App.tsx";
import { Toaster } from "@/components/ui/sonner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: 5 * 60 * 1000,
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

const enableDevOverlays = import.meta.env.DEV && import.meta.env.VITE_ENABLE_DEV_OVERLAYS === "true";

const Agentation = enableDevOverlays
  ? lazy(() =>
      import("agentation").then((module) => ({
        default: module.Agentation as ComponentType,
      }))
    )
  : null;

const HotkeysDevtools = enableDevOverlays
  ? lazy(() =>
      Promise.all([
        import("@tanstack/react-devtools"),
        import("@tanstack/react-hotkeys-devtools"),
      ]).then(([{ TanStackDevtools }, { hotkeysDevtoolsPlugin }]) => ({
        default: () => <TanStackDevtools plugins={[hotkeysDevtoolsPlugin()]} />,
      }))
    )
  : null;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HotkeysProvider>
        <App />
        <Toaster position="top-right" />
        {enableDevOverlays && (
          <>
            {Agentation && (
              <Suspense>
                <Agentation />
              </Suspense>
            )}
            {HotkeysDevtools && (
              <Suspense>
                <HotkeysDevtools />
              </Suspense>
            )}
          </>
        )}
      </HotkeysProvider>
    </QueryClientProvider>
  </StrictMode>,
);
