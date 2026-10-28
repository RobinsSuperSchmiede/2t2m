import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { PublicPlayer, Question } from "@2t2m/shared";
import { Flag, Map, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlayerAvatar } from "@/components/player";
import { useDuel, useServerClock } from "@/lib/duel";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function ScoreBlock({ player, score, side }: { player: PublicPlayer; score: number; side: "you" | "rival" }) {
  const { t } = useI18n();
  const isYou = side === "you";
  return (
    <div className={cn("flex min-w-0 flex-1 items-center gap-3", !isYou && "flex-row-reverse text-right")}>
      <PlayerAvatar
        player={player}
        className="size-11 md:size-12"
      />
      <div className="min-w-0">
        <div className="text-muted-foreground text-[10px] font-medium tracking-[0.25em] uppercase">
          {isYou ? t.common.you : t.common.opponent}
        </div>
        <div className="truncate text-sm font-semibold">{player.name}</div>
      </div>
      <div className={cn("relative ml-auto", !isYou && "mr-auto ml-0")}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={score}
            initial={{ y: 18, scale: 1.6, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -18, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 20 }}
            className={cn("font-mono text-4xl font-bold tabular-nums md:text-5xl", !isYou && "text-muted-foreground")}
          >
            {score}
          </motion.div>
        </AnimatePresence>
        {!isYou && (
          <AnimatePresence>
            {score > 0 && (
              <motion.span
                key={`plus-${score}`}
                initial={{ opacity: 1, y: 0 }}
                animate={{ opacity: 0, y: -36 }}
                transition={{ duration: 0.9 }}
                className="text-muted-foreground pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 text-sm font-bold"
              >
                +1
              </motion.span>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

function TugOfWar({ you, rival }: { you: number; rival: number }) {
  const total = you + rival;
  const share = total === 0 ? 50 : (you / total) * 100;
  return (
    <div className="bg-muted-foreground/30 relative h-1 overflow-hidden rounded-full">
      <motion.div
        className="bg-foreground absolute inset-y-0 left-0 rounded-full"
        animate={{ width: `${share}%` }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
      />
    </div>
  );
}

export function QuestionImage({ question }: { question: Pick<Question, "image"> }) {
  if (question.image.type === "svg") {
    return (
      <motion.div
        initial={{ rotateY: 90, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="flag-svg aspect-[3/2] w-full max-w-sm overflow-hidden rounded-md border"
        // Markup stammt vom eigenen Server (country-flag-icons), nicht von Nutzern.
        dangerouslySetInnerHTML={{ __html: question.image.markup }}
      />
    );
  }
  return (
    <svg viewBox={question.image.viewBox} className="aspect-square h-full max-w-full">
      <motion.path
        d={question.image.d}
        initial={{ pathLength: 0, fillOpacity: 0 }}
        animate={{ pathLength: 1, fillOpacity: 0.12 }}
        transition={{ pathLength: { duration: 0.6, ease: "easeInOut" }, fillOpacity: { delay: 0.3, duration: 0.4 } }}
        fill="var(--foreground)"
        stroke="var(--foreground)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function GameView() {
  const { state, answer, forfeit } = useDuel();
  const { t, local } = useI18n();
  const now = useServerClock(100);
  // Beim Mounten festhalten: Während der Exit-Animation rendert die Ansicht weiter, obwohl der Zustand schon zurückgesetzt sein kann.
  const [match] = useState(() => state.match!);
  const [shown, setShown] = useState<Question | null>(state.question);
  const [selected, setSelected] = useState<number | null>(null);
  const [showGo] = useState(() => now - match.startsAt < 900);

  const feedback = state.lastResult && shown && state.lastResult.questionIndex === shown.index ? state.lastResult : null;
  const remaining = Math.max(0, match.endsAt - now);
  const timeUp = remaining <= 0;
  const locked = feedback !== null && !feedback.correct && now < feedback.lockedUntil;

  // Nächste Frage erst nach kurzem Feedback (bzw. nach der Strafzeit) einblenden.
  useEffect(() => {
    const latest = state.question;
    if (!latest || latest.index === shown?.index) return;
    if (!shown || (!feedback && selected === null)) {
      setShown(latest);
      setSelected(null);
      return;
    }
    if (!feedback) return;
    // Nach falschen Antworten schickt der Server die Frage erst nach der Strafzeit – kurz Feedback zeigen reicht.
    const delay = feedback.correct ? 450 : Math.max(250, feedback.lockedUntil - Date.now() - state.clockOffset);
    const t = setTimeout(() => {
      setShown(latest);
      setSelected(null);
    }, delay);
    return () => clearTimeout(t);
  }, [state.question, shown, feedback, selected, state.clockOffset]);

  const choose = (option: number) => {
    if (!shown || selected !== null || timeUp) return;
    setSelected(option);
    answer(shown.index, option);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 4) choose(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const seconds = Math.ceil(remaining / 1000);
  const critical = seconds <= 10;

  return (
    <motion.div
      key="game"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="mx-auto flex max-w-3xl flex-col gap-6"
    >
      <AnimatePresence>
        {showGo && (
          <motion.div
            className="pointer-events-none fixed inset-0 z-50 grid place-items-center"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <motion.span
              initial={{ scale: 0.3 }}
              animate={{ scale: 1.4 }}
              transition={{ type: "spring", stiffness: 260, damping: 12 }}
              className="text-8xl font-black italic"
            >
              {t.game.go}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scoreboard */}
      <div className="bg-card space-y-3 rounded-xl border p-4">
        <div className="flex items-center gap-4">
          <ScoreBlock player={match.you} score={state.score} side="you" />
          <motion.div
            animate={critical && !timeUp ? { scale: [1, 1.12, 1] } : { scale: 1 }}
            transition={critical ? { duration: 1, repeat: Infinity } : undefined}
            className={cn(
              "flex w-20 shrink-0 flex-col items-center rounded-xl py-1",
              critical ? "text-danger" : "text-foreground",
            )}
          >
            <Timer className="size-4 opacity-60" />
            <span className="font-mono text-3xl font-black tabular-nums">{seconds}</span>
          </motion.div>
          <ScoreBlock player={match.opponent} score={state.opponentScore} side="rival" />
        </div>
        <TugOfWar you={state.score} rival={state.opponentScore} />
        <div className="bg-muted h-1 overflow-hidden rounded-full">
          <div
            className={cn("h-full rounded-full transition-[width] duration-100 ease-linear", critical ? "bg-danger" : "bg-foreground")}
            style={{ width: `${(remaining / (match.settings.durationSec * 1000)) * 100}%` }}
          />
        </div>
      </div>

      {/* Frage */}
      <div className="relative">
        <AnimatePresence mode="wait">
          {shown && (
            <motion.div
              key={shown.index}
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0, ...(locked ? { x: [0, -10, 10, -6, 6, 0] } : {}) }}
              exit={{ opacity: 0, x: -60 }}
              transition={{ duration: 0.25 }}
              className="bg-card flex flex-col items-center gap-6 rounded-xl border p-6 md:p-8"
            >
              <div className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                {shown.kind === "flag" ? <Flag className="size-4" /> : <Map className="size-4" />}
                {shown.kind === "flag" ? t.game.promptFlag : t.game.promptOutline}
                <span className="font-mono text-xs opacity-60">#{shown.index + 1}</span>
              </div>
              <div className="flex h-56 w-full items-center justify-center md:h-64" style={{ perspective: 800 }}>
                <QuestionImage question={shown} />
              </div>
              <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                {shown.options.map((opt, i) => {
                  const isSelected = selected === i;
                  const isCorrect = feedback?.correctOption === i;
                  const isWrong = feedback && isSelected && !feedback.correct;
                  return (
                    <motion.button
                      key={opt.en}
                      type="button"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0, scale: isSelected && feedback ? [1, 1.04, 1] : 1 }}
                      transition={{ delay: feedback ? 0 : 0.05 * i }}
                      whileHover={selected === null ? { y: -2 } : undefined}
                      whileTap={selected === null ? { scale: 0.97 } : undefined}
                      disabled={selected !== null || timeUp}
                      onClick={() => choose(i)}
                      className={cn(
                        "group flex h-12 items-center gap-3 rounded-md border px-4 text-left text-sm font-medium shadow-xs transition-all",
                        "bg-background hover:bg-accent dark:bg-input/30 dark:hover:bg-input/50 disabled:cursor-default",
                        isSelected && !feedback && "border-foreground/40",
                        isCorrect && "glow-success border-success bg-success/15 text-success hover:bg-success/15 dark:bg-success/15 dark:hover:bg-success/15",
                        isWrong && "glow-danger border-danger bg-danger/15 text-danger hover:bg-danger/15 dark:bg-danger/15 dark:hover:bg-danger/15",
                        feedback && !isCorrect && !isWrong && "opacity-50",
                      )}
                    >
                      <kbd className="bg-muted text-muted-foreground grid size-6 shrink-0 place-items-center rounded-md font-mono text-xs">
                        {i + 1}
                      </kbd>
                      <span className="truncate">{local(opt)}</span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {timeUp && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-background/70 absolute inset-0 z-10 grid place-items-center rounded-2xl backdrop-blur-sm"
            >
              <motion.span
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-5xl font-black"
              >
                {t.game.timeUp}
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex justify-center">
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => window.confirm(t.game.forfeitConfirm) && forfeit()}
          disabled={timeUp}>
          <Flag /> {t.game.forfeit}
        </Button>
      </div>
    </motion.div>
  );
}
