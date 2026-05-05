/**
 * SPA-Client-Entry für die Pi-Auslieferung.
 *
 * Dieser Entry wird NUR vom Pi-Bundle verwendet (vite.spa.config.ts).
 * Die Lovable-Cloud-Preview nutzt weiterhin die TanStack-Start-Bootstrap-Datei
 * unter src/router.tsx. Wir importieren denselben Router (`getRouter`), damit
 * Routen-Tree, Loader und Error-Komponenten 1:1 identisch bleiben.
 *
 * SSR ist hier nicht aktiv — das HTML kommt aus pi-spa/index.html, das Backend
 * (Fastify) liefert es als statisches File aus und alle Sub-Routen fallen via
 * SPA-Fallback auf dieselbe index.html zurück.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import "../src/styles.css";
import { getRouter } from "../src/router";

const router = getRouter();

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root-Element #root fehlt in index.html");
}

createRoot(rootEl).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);