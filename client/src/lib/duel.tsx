import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import type {
  AnswerResultPayload,
  ClientToServerEvents,
  GameEndPayload,
  MatchFoundPayload,
  ModeId,
  Question,
  QueueJoinedPayload,
  ServerToClientEvents,
  User,
} from "@2t2m/shared";
import { useAuth } from "./auth";
import { useI18n } from "./i18n";

type DuelSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type DuelPhase = "idle" | "searching" | "intro" | "playing" | "finished";

export interface DuelState {
  phase: DuelPhase;
  connected: boolean;
  queue: QueueJoinedPayload | null;
  match: MatchFoundPayload | null;
  /** Differenz Serverzeit − lokale Zeit in ms. */
  clockOffset: number;
  score: number;
  opponentScore: number;
  question: Question | null;
  lastResult: AnswerResultPayload | null;
  result: GameEndPayload | null;
}

type Action =
  | { type: "connected"; value: boolean }
  | { type: "queueJoined"; payload: QueueJoinedPayload }
  | { type: "queueLeft" }
  | { type: "matchFound"; payload: MatchFoundPayload; score?: number; opponentScore?: number; question?: Question | null }
  | { type: "question"; question: Question }
  | { type: "answerResult"; payload: AnswerResultPayload }
  | { type: "opponentScore"; score: number }
  | { type: "end"; payload: GameEndPayload }
  | { type: "reset" };

const initialState: DuelState = {
  phase: "idle",
  connected: false,
  queue: null,
  match: null,
  clockOffset: 0,
  score: 0,
  opponentScore: 0,
  question: null,
  lastResult: null,
  result: null,
};

function reducer(state: DuelState, action: Action): DuelState {
  switch (action.type) {
    case "connected":
      return { ...state, connected: action.value };
    case "queueJoined":
      return { ...initialState, connected: state.connected, phase: "searching", queue: action.payload };
    case "queueLeft":
      return state.phase === "searching" ? { ...state, phase: "idle", queue: null } : state;
    case "matchFound": {
      const clockOffset = action.payload.serverNow - Date.now();
      const started = action.payload.serverNow >= action.payload.startsAt;
      return {
        ...initialState,
        connected: state.connected,
        phase: started ? "playing" : "intro",
        match: action.payload,
        clockOffset,
        score: action.score ?? 0,
        opponentScore: action.opponentScore ?? 0,
        question: action.question ?? null,
      };
    }
    case "question":
      return { ...state, phase: "playing", question: action.question };
    case "answerResult":
      return { ...state, score: action.payload.score, lastResult: action.payload };
    case "opponentScore":
      return { ...state, opponentScore: action.score };
    case "end":
      return {
        ...state,
        phase: "finished",
        result: action.payload,
        score: action.payload.you.score,
        opponentScore: action.payload.opponent.score,
      };
    case "reset":
      return { ...initialState, connected: state.connected };
  }
}

interface DuelContextValue {
  state: DuelState;
  serverNow: () => number;
  joinQueue: (mode: ModeId) => void;
  leaveQueue: () => void;
  answer: (questionIndex: number, option: number) => void;
  forfeit: () => void;
  reset: () => void;
}

const DuelContext = createContext<DuelContextValue | null>(null);

export function DuelProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const queryClient = useQueryClient();
  const { t } = useI18n();
  // Socket-Handler sollen nicht bei jedem Sprachwechsel neu verbinden.
  const tRef = useRef(t);
  tRef.current = t;
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef = useRef<DuelSocket | null>(null);
  /** Modus, dem beigetreten werden soll, sobald die Verbindung steht (z. B. direkt nach dem Login). */
  const pendingJoin = useRef<ModeId | null>(null);
  const offsetRef = useRef(0);
  offsetRef.current = state.clockOffset;

  useEffect(() => {
    if (!userId) return;
    const socket: DuelSocket = io({ withCredentials: true });
    socketRef.current = socket;

    socket.on("connect", () => {
      dispatch({ type: "connected", value: true });
      if (pendingJoin.current) {
        socket.emit("queue:join", { mode: pendingJoin.current });
        pendingJoin.current = null;
      }
    });
    socket.on("disconnect", () => dispatch({ type: "connected", value: false }));
    socket.on("connect_error", () => dispatch({ type: "connected", value: false }));
    socket.on("queue:joined", (payload) => dispatch({ type: "queueJoined", payload }));
    socket.on("queue:left", () => dispatch({ type: "queueLeft" }));
    socket.on("queue:denied", ({ nextGameAt }) => {
      // Server hat das Stundenlimit durchgesetzt – Timer im Konto aktualisieren.
      queryClient.setQueryData<User | null>(["me"], (u) => (u ? { ...u, nextGameAt: new Date(nextGameAt).toISOString() } : u));
      dispatch({ type: "queueLeft" });
      toast(tRef.current.duel.cooldownTitle, { description: tRef.current.duel.cooldownDescription });
    });
    socket.on("match:found", (payload) => {
      dispatch({ type: "matchFound", payload });
      navigateRef.current("/");
    });
    socket.on("game:state", (payload) => {
      dispatch({
        type: "matchFound",
        payload,
        score: payload.score,
        opponentScore: payload.opponentScore,
        question: payload.question,
      });
      navigateRef.current("/");
    });
    socket.on("game:question", (question) => dispatch({ type: "question", question }));
    socket.on("game:answerResult", (payload) => dispatch({ type: "answerResult", payload }));
    socket.on("game:opponentScore", ({ score }) => dispatch({ type: "opponentScore", score }));
    socket.on("game:end", (payload) => {
      dispatch({ type: "end", payload });
      // Statistiken und Konto (nächstes freies Spiel) neu laden.
      void queryClient.invalidateQueries();
    });
    socket.on("app:error", ({ code }) => {
      const errors = tRef.current.errors;
      toast.error(code in errors ? errors[code as keyof typeof errors] : tRef.current.common.unknownError);
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      dispatch({ type: "reset" });
    };
  }, [userId, queryClient]);

  const serverNow = useCallback(() => Date.now() + offsetRef.current, []);

  const value = useMemo<DuelContextValue>(
    () => ({
      state,
      serverNow,
      joinQueue: (mode) => {
        const socket = socketRef.current;
        if (socket?.connected) socket.emit("queue:join", { mode });
        else pendingJoin.current = mode;
      },
      leaveQueue: () => socketRef.current?.emit("queue:leave"),
      answer: (questionIndex, option) => socketRef.current?.emit("game:answer", { questionIndex, option }),
      forfeit: () => socketRef.current?.emit("game:forfeit"),
      reset: () => dispatch({ type: "reset" }),
    }),
    [state, serverNow],
  );

  return <DuelContext.Provider value={value}>{children}</DuelContext.Provider>;
}

export function useDuel() {
  const ctx = useContext(DuelContext);
  if (!ctx) throw new Error("useDuel muss innerhalb von DuelProvider verwendet werden");
  return ctx;
}

/** Re-rendert in festem Intervall und liefert die aktuelle Serverzeit. */
export function useServerClock(intervalMs = 100) {
  const { serverNow } = useDuel();
  const [, force] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const id = setInterval(force, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return serverNow();
}
