import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { PRACTICE_STREAK_TO_LEARN, type PracticeItem, type QuestionKind } from "@2t2m/shared";
import { ArrowRight, Check, Crown, Flag, Layers, Lock, Map, PartyPopper, Play, Target, X } from "lucide-react";
import { toast } from "sonner";
import { AuthGate } from "@/components/auth-gate";
import { QuestionImage } from "@/components/duel/game-view";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Filter = "all" | QuestionKind;

const KIND_ICONS = { flag: Flag, outline: Map } as const;
const itemKey = (i: Pick<PracticeItem, "code" | "kind">) => `${i.kind}:${i.code}`;

function ProLocked() {
  const { t } = useI18n();
  return (
    <Card className="relative overflow-hidden">
      {/* Angedeuteter Inhalt im Hintergrund */}
      <div aria-hidden className="pointer-events-none flex select-none flex-col gap-3 p-6 opacity-40 blur-[3px]">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-muted h-10 rounded" />
        ))}
      </div>
      <div className="bg-background/60 absolute inset-0 grid place-items-center p-4">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <div className="bg-card grid size-10 place-items-center rounded-lg border">
            <Lock className="size-4" />
          </div>
          <div>
            <div className="font-semibold">{t.practice.lockedTitle}</div>
            <p className="text-muted-foreground mt-1 text-sm">{t.practice.lockedText}</p>
          </div>
          <Button asChild>
            <Link to="/pro">
              <Crown /> {t.stats.unlock}
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Punkte für die richtigen Antworten in Folge, die bis zum "Gelernt" fehlen. */
function StreakDots({ streak }: { streak: number }) {
  return (
    <span className="flex gap-1">
      {Array.from({ length: PRACTICE_STREAK_TO_LEARN }).map((_, i) => (
        <span key={i} className={cn("size-1.5 rounded-full", i < streak ? "bg-success" : "bg-muted-foreground/30")} />
      ))}
    </span>
  );
}

function Overview({ items, learned, onStart }: { items: PracticeItem[]; learned: number; onStart: (filter: Filter) => void }) {
  const { t, fmt, local } = useI18n();
  const [filter, setFilter] = useState<Filter>("all");
  const counts = { all: items.length, flag: 0, outline: 0 };
  for (const i of items) counts[i.kind]++;
  const shown = filter === "all" ? items : items.filter((i) => i.kind === filter);
  const filters: { value: Filter; label: string; icon: typeof Flag }[] = [
    { value: "all", label: t.practice.all, icon: Layers },
    { value: "flag", label: t.mode.flags, icon: Flag },
    { value: "outline", label: t.mode.outlines, icon: Map },
  ];

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="bg-muted grid size-12 place-items-center rounded-xl">
            {learned > 0 ? <PartyPopper className="size-5" /> : <Target className="size-5" />}
          </div>
          <div className="font-semibold">{learned > 0 ? t.practice.doneTitle : t.practice.emptyTitle}</div>
          <p className="text-muted-foreground max-w-sm text-sm">{learned > 0 ? t.practice.doneText : t.practice.emptyText}</p>
          <Button asChild variant="outline" className="mt-2">
            <Link to="/">{t.nav.play}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: t.practice.toPractice, value: counts.all },
          { label: t.mode.flags, value: counts.flag },
          { label: t.mode.outlines, value: counts.outline },
          { label: t.practice.learned, value: learned },
        ].map((s) => (
          <Card key={s.label} className="gap-1 py-4">
            <CardContent className="px-4">
              <div className="text-muted-foreground text-xs">{s.label}</div>
              <div className="text-2xl font-bold tabular-nums">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="radiogroup" aria-label={t.settings.questions} className="bg-muted grid grid-cols-3 gap-1 rounded-lg p-1 sm:w-80">
            {filters.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={filter === value}
                onClick={() => setFilter(value)}
                className={cn(
                  "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                  filter === value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3.5" /> {label}
                <span className="text-muted-foreground text-xs tabular-nums">{counts[value]}</span>
              </button>
            ))}
          </div>
          <Button size="lg" disabled={shown.length === 0} onClick={() => onStart(filter)}>
            <Play /> {t.practice.start}
          </Button>
        </CardHeader>
        <CardContent className="px-2 md:px-3">
          <ul className="divide-y">
            {shown.map((item) => {
              const Icon = KIND_ICONS[item.kind];
              return (
                <li key={itemKey(item)} className="flex items-center gap-3 px-2 py-2.5 sm:px-3">
                  <span className="bg-muted grid size-8 shrink-0 place-items-center rounded-md">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{local(item.name)}</span>
                  <span className="text-danger text-xs tabular-nums">{fmt(t.practice.wrongCount, { count: item.wrong })}</span>
                  <span title={fmt(t.practice.streakHint, { streak: item.streak, goal: PRACTICE_STREAK_TO_LEARN })}>
                    <StreakDots streak={item.streak} />
                  </span>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

/** Zufällig, aber nicht zweimal hintereinander dasselbe Land, solange es andere gibt. */
function pickNext(items: PracticeItem[], previous: string | null): PracticeItem | null {
  const candidates = items.length > 1 ? items.filter((i) => itemKey(i) !== previous) : items;
  return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
}

function Session({ initial, onExit }: { initial: PracticeItem[]; onExit: () => void }) {
  const { t, fmt, local, errorText } = useI18n();
  const [items, setItems] = useState(initial);
  const [current, setCurrent] = useState(() => pickNext(initial, null));
  const [round, setRound] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState({ correct: 0, answered: 0, learned: 0 });
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const question = useQuery({
    queryKey: ["practice-question", current?.code, current?.kind, round],
    queryFn: () => api.practiceQuestion(current!.code, current!.kind),
    enabled: Boolean(current),
    staleTime: Infinity,
    gcTime: 0,
  });

  const next = (list = items) => {
    clearTimeout(advanceTimer.current);
    setSelected(null);
    setCurrent(pickNext(list, current ? itemKey(current) : null));
    setRound((r) => r + 1);
  };

  const choose = (code: string) => {
    if (!current || !question.data || selected !== null) return;
    setSelected(code);
    const correct = code === current.code;
    setScore((s) => ({ ...s, correct: s.correct + (correct ? 1 : 0), answered: s.answered + 1 }));
    const answeredAt = Date.now();
    // Sofortiges Feedback lokal; der Server entscheidet, ob das Land damit gelernt ist.
    api
      .practiceAnswer(current.code, current.kind, code)
      .then(({ item }) => {
        const key = itemKey(current);
        const updated = item ? items.map((i) => (itemKey(i) === key ? item : i)) : items.filter((i) => itemKey(i) !== key);
        setItems(updated);
        if (!item) {
          setScore((s) => ({ ...s, learned: s.learned + 1 }));
          toast.success(fmt(t.practice.learnedToast, { name: local(current.name) }));
        }
        // Nach einer richtigen Antwort automatisch weiter, mit der aktualisierten Liste.
        if (correct) advanceTimer.current = setTimeout(() => next(updated), Math.max(0, 700 - (Date.now() - answeredAt)));
      })
      .catch((err) => {
        toast.error(errorText(err));
        if (correct) next();
      });
  };

  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 4 && question.data) choose(question.data.options[n - 1]!.code);
      else if ((e.key === "Enter" || e.key === " ") && selected !== null) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const remaining = items.length;
  const finished = !current || (selected === null && remaining === 0);

  if (finished) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <div className="bg-muted grid size-12 place-items-center rounded-xl">
            <PartyPopper className="size-5" />
          </div>
          <div className="font-semibold">{t.practice.doneTitle}</div>
          <p className="text-muted-foreground text-sm">{fmt(t.practice.sessionScore, score)}</p>
          <Button className="mt-2" onClick={onExit}>
            {t.practice.exit}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const Icon = KIND_ICONS[current.kind];
  const wasCorrect = selected === current.code;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="text-muted-foreground flex items-center justify-between gap-3 text-sm">
        <span className="tabular-nums">
          {fmt(t.practice.remaining, { count: remaining })} · {fmt(t.practice.sessionScore, score)}
        </span>
        <Button variant="ghost" size="sm" onClick={onExit}>
          <X /> {t.practice.exit}
        </Button>
      </div>

      <Card className="py-5">
        <CardContent className="flex flex-col items-center gap-5 px-4 md:px-6">
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Icon className="size-4" />
            {current.kind === "flag" ? t.game.promptFlag : t.game.promptOutline}
            <StreakDots streak={current.streak} />
          </div>
          <div className="flex h-56 w-full items-center justify-center md:h-64">
            {question.data ? <QuestionImage key={round} question={question.data} /> : <Skeleton className="h-full w-full max-w-sm" />}
          </div>
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
            {(question.data?.options ?? []).map((opt, i) => {
              const isAnswer = selected !== null && opt.code === current.code;
              const isWrong = selected === opt.code && !wasCorrect;
              return (
                <button
                  key={opt.code}
                  type="button"
                  disabled={selected !== null}
                  onClick={() => choose(opt.code)}
                  className={cn(
                    "flex h-12 items-center gap-3 rounded-md border px-4 text-left text-sm font-medium shadow-xs transition-all",
                    "bg-background hover:bg-accent dark:bg-input/30 dark:hover:bg-input/50 disabled:cursor-default",
                    isAnswer && "glow-success border-success bg-success/15 text-success hover:bg-success/15 dark:bg-success/15 dark:hover:bg-success/15",
                    isWrong && "glow-danger border-danger bg-danger/15 text-danger hover:bg-danger/15 dark:bg-danger/15 dark:hover:bg-danger/15",
                    selected !== null && !isAnswer && !isWrong && "opacity-50",
                  )}
                >
                  <kbd className="bg-muted text-muted-foreground grid size-6 shrink-0 place-items-center rounded-md font-mono text-xs">
                    {i + 1}
                  </kbd>
                  <span className="truncate">{local(opt.name)}</span>
                  {isAnswer && <Check className="ml-auto size-4 shrink-0" />}
                </button>
              );
            })}
          </div>
          <AnimatePresence>
            {selected !== null && !wasCorrect && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                <Button onClick={() => next()}>
                  {t.practice.next} <ArrowRight />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}

function PracticeContent() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<PracticeItem[] | null>(null);
  const pool = useQuery({ queryKey: ["practice"], queryFn: api.practice, enabled: Boolean(user?.pro) });

  if (!user?.pro) return <ProLocked />;
  if (pool.isLoading || !pool.data) return <Skeleton className="h-64 w-full" />;

  if (session) {
    return (
      <Session
        initial={session}
        onExit={() => {
          setSession(null);
          void queryClient.invalidateQueries({ queryKey: ["practice"] });
        }}
      />
    );
  }
  return (
    <Overview
      items={pool.data.items}
      learned={pool.data.learned}
      onStart={(filter) => setSession(filter === "all" ? pool.data.items : pool.data.items.filter((i) => i.kind === filter))}
    />
  );
}

export function PracticePage() {
  const { t } = useI18n();
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t.practice.title}</h1>
        <p className="text-muted-foreground mt-1">{t.practice.subtitle}</p>
      </div>
      <AuthGate icon={Target} title={t.practice.gateTitle} description={t.practice.gateDescription}>
        <PracticeContent />
      </AuthGate>
    </motion.div>
  );
}
