import { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import "@xyflow/react/dist/style.css";
import "./index.css";
import App from "./App.tsx";
import { Toaster } from "@/components/ui/sonner";
import { Agentation } from "agentation";

const HotkeysDevtools = import.meta.env.DEV
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
    <HotkeysProvider>
      <App />
      <Toaster position="top-right" />
      {import.meta.env.DEV && (
        <>
          <Agentation />
          {HotkeysDevtools && (
            <Suspense>
              <HotkeysDevtools />
            </Suspense>
          )}
        </>
      )}
    </HotkeysProvider>
  </StrictMode>,
);
