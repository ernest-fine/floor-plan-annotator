import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@/shared/styles/tokens.css";
import "@/shared/styles/base.css";
import "@/shared/styles/ui.css";
import "@/features/annotator/styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
