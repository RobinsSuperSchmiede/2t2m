import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { DEFAULT_MODE, GAME_DURATIONS_SEC, QUESTION_SETS, type GameSettings, type QuestionSet } from "@2t2m/shared";
import { BookOpen, Clock, Crown, Flag, Globe2, Layers, Loader2, Lock, Map, Medal, Swords, Timer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InlineAd } from "@/components/ads";
import { GameView } from "@/components/duel/game-view";
import { ResultView } from "@/components/duel/result-view";
import { SearchingView } from "@/components/duel/searching";
import { VersusIntro } from "@/components/duel/versus-intro";
import { RankBadge } from "@/components/player";
import { formatCountdown, useCooldown } from "@/hooks/use-cooldown";
import { useGameSettings } from "@/hooks/use-game-settings";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDuel } from "@/lib/duel";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const UPCOMING = [
  { icon: BookOpen, name: "history" },
  { icon: Globe2, name: "capitals" },
  { icon: Medal, name: "sport" },
] as const;

const QUESTION_ICONS: Record<QuestionSet, typeof Flag> = { mixed: Layers, flag: Flag, outline: Map };

/** Segmentierte Auswahl – eine Option ist immer aktiv. */
function Segmented<T extends string | number>({
  label,
  icon: Icon,
  value,
  options,
  onChange,
}: {
  label: string;
  icon: typeof Flag;
  value: T;
  options: { value: T; label: string; icon?: typeof Flag }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <div className="text-muted-foreground flex items-center gap-1.5 text-sm sm:w-28 sm:shrink-0">
        <Icon className="text-foreground size-4" /> {label}
      </div>
      <div role="radiogroup" aria-label={label} className="bg-muted grid flex-1 auto-cols-fr grid-flow-col gap-1 rounded-lg p-1">
        {options.map((o) => {
          const active = o.value === value;
          const OptionIcon = o.icon;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.value)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {OptionIcon && <OptionIcon className="size-3.5" />}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SettingsPicker({ settings, onChange }: { settings: GameSettings; onChange: (patch: Partial<GameSettings>) => void }) {
  const { t, durationText } = useI18n();
  const questionLabels: Record<QuestionSet, string> = { mixed: t.settings.mixed, flag: t.mode.flags, outline: t.mode.outlines };
  return (
    <Card className="w-full py-4">
      <CardContent className="flex flex-col gap-3 px-4 text-left">
        <Segmented
          label={t.settings.duration}
          icon={Timer}
          value={settings.durationSec}
          options={GAME_DURATIONS_SEC.map((sec) => ({ value: sec, label: durationText(sec) }))}
          onChange={(durationSec) => onChange({ durationSec })}
        />
        <Segmented
          label={t.settings.questions}
          icon={Layers}
          value={settings.questions}
          options={QUESTION_SETS.map((q) => ({ value: q, label: questionLabels[q], icon: QUESTION_ICONS[q] }))}
          onChange={(questions) => onChange({ questions })}
        />
      </CardContent>
    </Card>
  );
}

/** Hauptaktion: Spielen, Anmelden oder – für kostenlose Spieler – Wartezeit bis zum nächsten Duell. */
function PlayAction({ settings }: { settings: GameSettings }) {
  const { user, requireLogin } = useAuth();
  const { joinQueue, state } = useDuel();
  const cooldown = useCooldown();
  const { t } = useI18n();

  if (user && cooldown > 0) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        <div className="bg-card w-full rounded-xl border p-5">
          <div className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
            <Clock className="size-4" /> {t.play.nextFreeIn}
          </div>
          <div className="mt-1 font-mono text-4xl font-bold tabular-nums">{formatCountdown(cooldown)}</div>
        </div>
        <Button size="lg" className="w-full" asChild>
          <Link to="/pro">
            <Crown /> {t.play.continueWithPro}
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <Button
        size="lg"
        className="min-w-48"
        disabled={Boolean(user) && !state.connected}
        onClick={() => requireLogin(() => joinQueue(DEFAULT_MODE, settings))}
      >
        {user && !state.connected ? <Loader2 className="animate-spin" /> : <Swords />}
        {t.play.play}
      </Button>
      <p className="text-muted-foreground text-xs">
        {!user ? t.play.signInHint : user.pro ? t.play.proHint : t.play.freeHint}
      </p>
    </div>
  );
}

function IdleView() {
  const { user } = useAuth();
  const dashboard = useQuery({
    queryKey: ["dashboard", DEFAULT_MODE],
    queryFn: () => api.dashboard(DEFAULT_MODE),
    enabled: Boolean(user),
  });
  const { t } = useI18n();
  const [settings, setSettings] = useGameSettings();

  return (
    <motion.div
      key="idle"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="mx-auto flex max-w-2xl flex-col items-center gap-8 pt-4 text-center md:pt-12"
    >
      <div className="space-y-4">
        <Badge variant="outline">{t.mode.badge}</Badge>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{t.mode.name}</h1>
        <p className="text-muted-foreground mx-auto max-w-md">{t.mode.description}</p>
        {dashboard.data && (
          <div className="flex justify-center">
            <RankBadge rating={dashboard.data.stats.rating} showTiers />
          </div>
        )}
      </div>

      <SettingsPicker settings={settings} onChange={setSettings} />

      <PlayAction settings={settings} />

      <div className="flex flex-wrap justify-center gap-2">
        {UPCOMING.map(({ icon: Icon, name }) => (
          <Badge key={name} variant="outline" className="text-muted-foreground gap-1.5">
            <Icon className="size-3" /> {t.topics[name]} <Lock className="size-3" />
          </Badge>
        ))}
      </div>

      <InlineAd className="w-full text-left" />
    </motion.div>
  );
}

export function PlayPage() {
  const { state } = useDuel();
  return (
    <AnimatePresence mode="wait">
      {state.phase === "idle" && <IdleView key="idle" />}
      {state.phase === "searching" && <SearchingView key="searching" />}
      {state.phase === "intro" && <VersusIntro key={`intro-${state.match?.matchId}`} />}
      {state.phase === "playing" && <GameView key={`game-${state.match?.matchId}`} />}
      {state.phase === "finished" && <ResultView key={`result-${state.match?.matchId}`} />}
    </AnimatePresence>
  );
}
