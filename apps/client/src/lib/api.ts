import type {
  AuthConfigResponse,
  BackdropItem,
  DashboardResponse,
  HistoryResponse,
  LeaderboardEntry,
  ModeId,
  PracticeAnswerResponse,
  PracticeQuestion,
  PracticeResponse,
  QuestionKind,
  User,
} from "@2t2m/shared";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.error ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  authConfig: () => request<AuthConfigResponse>("/auth/config"),
  me: () => request<User>("/auth/me"),
  loginGoogle: (credential: string) =>
    request<User>("/auth/google", { method: "POST", body: JSON.stringify({ credential }) }),
  loginDev: (name: string) => request<User>("/auth/dev", { method: "POST", body: JSON.stringify({ name }) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  dashboard: (mode: ModeId) => request<DashboardResponse>(`/dashboard?mode=${mode}`),
  history: (mode: ModeId, page: number) => request<HistoryResponse>(`/history?mode=${mode}&page=${page}`),
  backdrop: () => request<BackdropItem[]>("/backdrop"),
  leaderboard: (mode: ModeId) => request<LeaderboardEntry[]>(`/leaderboard?mode=${mode}`),
  checkout: () => request<{ url: string }>("/billing/checkout", { method: "POST" }),
  portal: () => request<{ url: string }>("/billing/portal", { method: "POST" }),
  syncCheckout: (sessionId: string) =>
    request<User>("/billing/sync", { method: "POST", body: JSON.stringify({ sessionId }) }),
  devTogglePro: () => request<User>("/billing/dev-toggle", { method: "POST" }),
  practice: () => request<PracticeResponse>("/practice"),
  practiceQuestion: (code: string, kind: QuestionKind) =>
    request<PracticeQuestion>(`/practice/question?code=${encodeURIComponent(code)}&kind=${kind}`),
  practiceAnswer: (countryCode: string, kind: QuestionKind, answerCode: string) =>
    request<PracticeAnswerResponse>("/practice/answer", {
      method: "POST",
      body: JSON.stringify({ countryCode, kind, answerCode }),
    }),
};
