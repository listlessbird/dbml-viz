import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@xyflow/react/dist/style.css";
import "./index.css";
import App from "./App.tsx";
import { Toaster } from "sonner";
import { Agentation } from "agentation";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <>
      <App />
      <Toaster richColors position="top-right" />
      {process.env.NODE_ENV === "development" && <Agentation />}
    </>
  </StrictMode>,
);
