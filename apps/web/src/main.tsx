import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/app/providers";
import { router } from "@/app/router";
import { registerSW } from "virtual:pwa-register";
import { AuthProvider } from "@/features/auth/AuthProvider";
import { useSessionStore } from "@/store/session";
import i18n, { applyLocale } from "@/i18n";
import "@/index.css";

// applique la langue + direction au démarrage
applyLocale(useSessionStore.getState().locale);
void i18n;

// Service Worker (PWA §49). `prompt` : on notifie quand une MAJ est prête.
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm("Nouvelle version disponible. Recharger ?")) void updateSW(true);
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
