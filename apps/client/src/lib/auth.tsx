import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@2t2m/shared";
import { LoginDialog } from "@/components/login-dialog";
import { api, ApiError } from "./api";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  loginGoogle: (credential: string) => Promise<void>;
  loginDev: (name: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Öffnet das Anmeldefenster; `then` läuft nach erfolgreicher Anmeldung. */
  requireLogin: (then?: () => void) => void;
  setUser: (user: User) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const afterLogin = useRef<(() => void) | null>(null);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await api.me();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: Infinity,
  });

  const onLogin = (user: User) => {
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth-config" });
    queryClient.setQueryData(["me"], user);
    setDialogOpen(false);
    const then = afterLogin.current;
    afterLogin.current = null;
    then?.();
  };

  const google = useMutation({ mutationFn: api.loginGoogle, onSuccess: onLogin });
  const dev = useMutation({ mutationFn: api.loginDev, onSuccess: onLogin });
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "auth-config" });
      queryClient.setQueryData(["me"], null);
    },
  });

  const user = me.data ?? null;
  const requireLogin = useCallback(
    (then?: () => void) => {
      if (user) {
        then?.();
        return;
      }
      afterLogin.current = then ?? null;
      setDialogOpen(true);
    },
    [user],
  );

  const value: AuthContextValue = {
    user,
    loading: me.isLoading,
    loginGoogle: async (credential) => void (await google.mutateAsync(credential)),
    loginDev: async (name) => void (await dev.mutateAsync(name)),
    logout: async () => void (await logout.mutateAsync()),
    requireLogin,
    setUser: (u) => queryClient.setQueryData(["me"], u),
    refreshUser: async () => void (await queryClient.invalidateQueries({ queryKey: ["me"] })),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      <LoginDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) afterLogin.current = null;
        }}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth muss innerhalb von AuthProvider verwendet werden");
  return ctx;
}
