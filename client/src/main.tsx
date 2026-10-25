import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, Navigate, Outlet, RouterProvider } from "react-router";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout";
import { api } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/auth";
import { DuelProvider } from "@/lib/duel";
import { DashboardPage } from "@/pages/dashboard";
import { HistoryPage } from "@/pages/history";
import { LeaderboardPage } from "@/pages/leaderboard";
import { LoginPage } from "@/pages/login";
import { PlayPage } from "@/pages/play";
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

function Root() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <FullscreenLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return (
    <DuelProvider>
      <AppLayout />
    </DuelProvider>
  );
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return <FullscreenLoader />;
  if (user) return <Navigate to="/" replace />;
  return <LoginPage />;
}

const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      { path: "/login", element: <LoginRoute /> },
      {
        element: <RequireAuth />,
        children: [
          { path: "/", element: <DashboardPage /> },
          { path: "/play", element: <PlayPage /> },
          { path: "/history", element: <HistoryPage /> },
          { path: "/leaderboard", element: <LeaderboardPage /> },
        ],
      },
      { path: "*", element: <Navigate to="/" replace /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <GoogleProvider>
        <TooltipProvider>
          <RouterProvider router={router} />
          <Toaster position="top-center" richColors />
        </TooltipProvider>
      </GoogleProvider>
    </QueryClientProvider>
  </StrictMode>,
);
