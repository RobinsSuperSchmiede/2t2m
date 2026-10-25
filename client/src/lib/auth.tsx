import { createContext, useContext, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@2t2m/shared";
import { api, ApiError } from "./api";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  loginGoogle: (credential: string) => Promise<void>;
  loginDev: (name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
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
    queryClient.clear();
    queryClient.setQueryData(["me"], user);
  };

  const google = useMutation({ mutationFn: api.loginGoogle, onSuccess: onLogin });
  const dev = useMutation({ mutationFn: api.loginDev, onSuccess: onLogin });
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      queryClient.clear();
      queryClient.setQueryData(["me"], null);
    },
  });

  const value: AuthContextValue = {
    user: me.data ?? null,
    loading: me.isLoading,
    loginGoogle: async (credential) => void (await google.mutateAsync(credential)),
    loginDev: async (name) => void (await dev.mutateAsync(name)),
    logout: async () => void (await logout.mutateAsync()),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth muss innerhalb von AuthProvider verwendet werden");
  return ctx;
}
