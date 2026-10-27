import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorPage } from "@/components/error-page";
import { AppLayout } from "@/components/layout";
import { api } from "@/lib/api";
import { AuthProvider } from "@/lib/auth";
import { DuelProvider } from "@/lib/duel";
import { I18nProvider } from "@/lib/i18n";
import { ThemeProvider } from "@/lib/theme";
import { HistoryPage } from "@/pages/history";
import { LeaderboardPage } from "@/pages/leaderboard";
import { PlayPage } from "@/pages/play";
import { ProPage } from "@/pages/pro";
import { StatsPage } from "@/pages/stats";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

function FullscreenLoader() {
  return (
    <div className="grid min-h-svh place-items-center">
      <Loader2 className="text-muted-foreground size-8 animate-spin" />
    </div>
  );
}

/** Google-Provider braucht die Client-ID, die der Server ausliefert. */
function GoogleProvider({ children }: { children: ReactNode }) {
  const config = useQuery({ queryKey: ["auth-config"], queryFn: api.authConfig, staleTime: Infinity });
  if (config.isLoading) return <FullscreenLoader />;
  const clientId = config.data?.googleClientId;
  return clientId ? <GoogleOAuthProvider clientId={clientId}>{children}</GoogleOAuthProvider> : <>{children}</>;
}

/** Alles ist öffentlich erreichbar – angemeldet wird erst beim Klick auf „Spielen“. */
function Root() {
  return (
    <AuthProvider>
      <DuelProvider>
        <AppLayout />
      </DuelProvider>
    </AuthProvider>
  );
}

const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <ErrorPage />,
    children: [
      { path: "/", element: <PlayPage /> },
      { path: "/stats", element: <StatsPage /> },
      { path: "/history", element: <HistoryPage /> },
      { path: "/leaderboard", element: <LeaderboardPage /> },
      { path: "/pro", element: <ProPage /> },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <I18nProvider>
        <QueryClientProvider client={queryClient}>
          <GoogleProvider>
            <TooltipProvider>
              <RouterProvider router={router} />
              <Toaster position="top-center" richColors />
            </TooltipProvider>
          </GoogleProvider>
        </QueryClientProvider>
      </I18nProvider>
    </ThemeProvider>
  </StrictMode>,
);
