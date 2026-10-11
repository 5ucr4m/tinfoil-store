import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { Shell } from "./components/Shell";
import { ContextMenuProvider } from "./components/ContextMenu";
import { Spinner, ToastProvider } from "./components/ui";
import "./index.css";
import { api } from "./lib/api";
import { onUploadDone } from "./lib/uploads";
import { AccessPage } from "./pages/Access";
import { AuthPage } from "./pages/Auth";
import { IdentifyPage } from "./pages/Identify";
import { IntegrationsPage } from "./pages/Integrations";
import { LibraryPage } from "./pages/Library";
import { TinfoilPage } from "./pages/Tinfoil";
import { UploadPage } from "./pages/Upload";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: false } },
});

function App() {
  const qc = useQueryClient();
  const auth = useQuery({
    queryKey: ["auth"],
    queryFn: () => api<{ needsSetup: boolean; authenticated: boolean }>("/auth/state"),
  });

  useEffect(() => {
    const logout = () => qc.setQueryData(["auth"], { needsSetup: false, authenticated: false });
    window.addEventListener("cartucho:logout", logout);
    const off = onUploadDone(() => {
      void qc.invalidateQueries({ queryKey: ["files"] });
      void qc.invalidateQueries({ queryKey: ["integrations"] });
      void qc.invalidateQueries({ queryKey: ["identify-pending"] });
    });
    return () => {
      window.removeEventListener("cartucho:logout", logout);
      off();
    };
  }, [qc]);

  if (!auth.data) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (!auth.data.authenticated) {
    return (
      <AuthPage
        setup={auth.data.needsSetup}
        onDone={() => {
          qc.clear();
          qc.setQueryData(["auth"], { needsSetup: false, authenticated: true });
        }}
      />
    );
  }

  return (
    <Shell onLogout={() => qc.setQueryData(["auth"], { needsSetup: false, authenticated: false })}>
      <Routes>
        <Route path="/" element={<LibraryPage />} />
        <Route path="/enviar" element={<UploadPage />} />
        <Route path="/integracoes" element={<IntegrationsPage />} />
        <Route path="/acesso" element={<AccessPage />} />
        <Route path="/tinfoil" element={<TinfoilPage />} />
        <Route path="/identificar" element={<IdentifyPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Shell>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastProvider>
          <ContextMenuProvider>
            <App />
          </ContextMenuProvider>
        </ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
