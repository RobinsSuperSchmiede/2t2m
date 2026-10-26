import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { DEFAULT_MODE, MODES } from "@2t2m/shared";
import { BookOpen, Clock, Crown, Flag, Globe2, Loader2, Lock, Map, Medal, Swords, Timer } from "lucide-react";
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
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDuel } from "@/lib/duel";

const UPCOMING = [
  { icon: BookOpen, name: "Geschichte" },
  { icon: Globe2, name: "Hauptstädte" },
  { icon: Medal, name: "Sport" },
];

/** Hauptaktion: Spielen, Anmelden oder – für kostenlose Spieler – Wartezeit bis zum nächsten Duell. */
function PlayAction() {
  const { user, requireLogin } = useAuth();
  const { joinQueue, state } = useDuel();
  const cooldown = useCooldown();

  if (user && cooldown > 0) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        <div className="bg-card w-full rounded-xl border p-5">
          <div className="text-muted-foreground flex items-center justify-center gap-2 text-sm">
            <Clock className="size-4" /> Nächstes kostenloses Duell in
          </div>
          <div className="mt-1 font-mono text-4xl font-bold tabular-nums">{formatCountdown(cooldown)}</div>
        </div>
        <Button size="lg" className="w-full" asChild>
          <Link to="/pro">
            <Crown /> Mit Pro sofort weiterspielen
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
        onClick={() => requireLogin(() => joinQueue(DEFAULT_MODE))}
      >
        {user && !state.connected ? <Loader2 className="animate-spin" /> : <Swords />}
        Spielen
      </Button>
      <p className="text-muted-foreground text-xs">
        {!user
          ? "Anmelden und sofort loslegen"
          : user.pro
            ? "Pro · unbegrenzt spielen"
            : "Kostenlos: 1 Duell pro Stunde"}
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
  const mode = MODES[DEFAULT_MODE];

  return (
    <motion.div
      key="idle"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="mx-auto flex max-w-2xl flex-col items-center gap-8 pt-4 text-center md:pt-12"
    >
      <div className="space-y-4">
        <Badge variant="outline">Geografie · Ranked</Badge>
        <h1 className="text-4xl font-bold tracking-tight md:text-5xl">{mode.name}</h1>
        <p className="text-muted-foreground mx-auto max-w-md">{mode.description}</p>
        {dashboard.data && (
          <div className="flex justify-center">
            <RankBadge rating={dashboard.data.stats.rating} />
          </div>
        )}
      </div>

      <PlayAction />

      <Card className="w-full py-4">
        <CardContent className="grid grid-cols-3 gap-2 px-4 text-sm">
          {[
            { icon: Timer, label: "60 Sekunden" },
            { icon: Flag, label: "Flaggen" },
            { icon: Map, label: "Umrisse" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="text-muted-foreground flex flex-col items-center gap-1.5 sm:flex-row sm:justify-center">
              <Icon className="text-foreground size-4" /> {label}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex flex-wrap justify-center gap-2">
        {UPCOMING.map(({ icon: Icon, name }) => (
          <Badge key={name} variant="outline" className="text-muted-foreground gap-1.5">
            <Icon className="size-3" /> {name} <Lock className="size-3" />
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
