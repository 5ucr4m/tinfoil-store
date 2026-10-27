import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import { Shell } from "./components/Shell";
import { ContextMenuProvider } from "./components/ContextMenu";
import { Spinner, ToastProvider } from "./components/ui";
import "./index.css";
import { useI18n } from "./i18n";
import { api, type SessionUser } from "./lib/api";
import { SessionProvider } from "./lib/session";
import { onUploadDone } from "./lib/uploads";
import { AccessPage } from "./pages/Access";
import { AccountPage } from "./pages/Account";
import { AuthPage } from "./pages/Auth";
import { IdentifyPage } from "./pages/Identify";
import { IntegrationsPage } from "./pages/Integrations";
import { LegalPage } from "./pages/Legal";
import { LibraryPage } from "./pages/Library";
import { TinfoilPage } from "./pages/Tinfoil";
import { UploadPage } from "./pages/Upload";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: false } },
});

function App() {
  // Re-render the whole tree when the language changes (formatters read it directly).
  useI18n();
  const qc = useQueryClient();
  const { pathname } = useLocation();
  const auth = useQuery({
    queryKey: ["auth"],
    queryFn: () => api<{ needsSetup: boolean; user: SessionUser | null }>("/auth/state"),
  });

  useEffect(() => {
    const logout = () => qc.setQueryData(["auth"], { needsSetup: false, user: null });
    const recheck = () => void qc.invalidateQueries({ queryKey: ["auth"] });
    window.addEventListener("cartucho:logout", logout);
    window.addEventListener("cartucho:recheck-session", recheck);
    const off = onUploadDone(() => {
      void qc.invalidateQueries({ queryKey: ["files"] });
      void qc.invalidateQueries({ queryKey: ["integrations"] });
      void qc.invalidateQueries({ queryKey: ["identify-pending"] });
    });
    return () => {
      window.removeEventListener("cartucho:logout", logout);
      window.removeEventListener("cartucho:recheck-session", recheck);
      off();
    };
  }, [qc]);

  // Public pages: Google's OAuth consent screen links to them, signed in or not.
  if (pathname === "/privacy" || pathname === "/terms") return <LegalPage doc={pathname === "/privacy" ? "privacy" : "terms"} />;

  if (!auth.data) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (!auth.data.user) {
    return (
      <AuthPage
        setup={auth.data.needsSetup}
        onDone={(user) => {
          // Drop data cached for the signed-out state, but keep the auth query: clearing it
          // would detach this component from the cache and leave the sign-in screen up.
          qc.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth" });
          qc.setQueryData(["auth"], { needsSetup: false, user });
        }}
      />
    );
  }

  // Read-only accounts have no route to the pages that change things: an unknown path
  // lands on the library instead, so the panel never shows them a door they can't open.
  const isAdmin = auth.data.user.role === "admin";

  return (
    <SessionProvider user={auth.data.user}>
      <Shell onLogout={() => qc.setQueryData(["auth"], { needsSetup: false, user: null })}>
        <Routes>
          <Route path="/" element={<LibraryPage />} />
          {/* "/tinfoil" belongs to the store itself; the panel page lives at /connect. */}
          <Route path="/connect" element={<TinfoilPage />} />
          <Route path="/account" element={<AccountPage />} />
          {isAdmin && (
            <>
              <Route path="/upload" element={<UploadPage />} />
              <Route path="/integrations" element={<IntegrationsPage />} />
              <Route path="/access" element={<AccessPage />} />
              <Route path="/identify" element={<IdentifyPage />} />
              {/* Portuguese paths from the first release */}
              <Route path="/enviar" element={<Navigate to="/upload" replace />} />
              <Route path="/integracoes" element={<Navigate to={`/integrations${location.search}`} replace />} />
              <Route path="/acesso" element={<Navigate to="/access" replace />} />
              <Route path="/identificar" element={<Navigate to="/identify" replace />} />
            </>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </SessionProvider>
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
