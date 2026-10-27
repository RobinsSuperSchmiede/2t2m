import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { animate, motion } from "motion/react";
import confetti from "canvas-confetti";
import { DEFAULT_MODE, getTier } from "@2t2m/shared";
import { ArrowUpRight, BarChart3, Clock, Crown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RatingDelta } from "@/components/match-row";
import { PlayerAvatar, RankBadge } from "@/components/player";
import { formatCountdown, useCooldown } from "@/hooks/use-cooldown";
import { useDuel } from "@/lib/duel";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

function AnimatedNumber({ from, to, delay = 0 }: { from: number; to: number; delay?: number }) {
  const [value, setValue] = useState(from);
  useEffect(() => {
    const controls = animate(from, to, {
      duration: 1.2,
      delay,
      ease: "easeOut",
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [from, to, delay]);
  return <>{value}</>;
}

const HEADLINE_CLASS = {
  win: "text-success glow-text-success",
  loss: "text-danger glow-text-danger",
  draw: "text-foreground",
};

export function ResultView() {
  const { state, joinQueue, reset } = useDuel();
  const navigate = useNavigate();
  const cooldown = useCooldown();
  const { t, fmt } = useI18n();
  // Beim Mounten festhalten: Während der Exit-Animation rendert die Ansicht weiter, obwohl der Zustand schon zurückgesetzt sein kann.
  const [{ result, match }] = useState(() => ({ result: state.result!, match: state.match! }));
  const tierBefore = getTier(result.you.ratingBefore);
  const tierAfter = getTier(result.you.ratingAfter);
  const tierChanged = tierBefore.id !== tierAfter.id;
  const accuracy = result.you.answered > 0 ? Math.round((result.you.score / result.you.answered) * 100) : 0;

  useEffect(() => {
    if (result.outcome !== "win") return;
    const end = Date.now() + 1200;
    const frame = () => {
      confetti({ particleCount: 4, angle: 60, spread: 70, origin: { x: 0, y: 0.7 } });
      confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1, y: 0.7 } });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    confetti({ particleCount: 120, spread: 90, origin: { y: 0.4 } });
    frame();
  }, [result.outcome]);

  return (
    <motion.div
      key="result"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="mx-auto flex max-w-2xl flex-col items-center gap-8 py-6 text-center"
    >
      <div>
        <motion.h1
          initial={{ scale: 0.3, opacity: 0, rotate: -6 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 220, damping: 12 }}
          className={cn(
            "pb-2 text-6xl font-black tracking-tight md:text-7xl",
            HEADLINE_CLASS[result.outcome],
          )}
        >
          {t.outcome[result.outcome]}
        </motion.h1>
        {result.forfeit && (
          <p className="text-muted-foreground">
            {result.outcome === "win" ? t.result.opponentForfeited : t.result.youForfeited}
          </p>
        )}
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="w-full"
      >
        <Card className="flex-row items-center justify-between gap-4 px-6 py-6 md:px-10">
          {[
            { player: match.you, score: result.you.score, color: "text-foreground" },
            null,
            { player: match.opponent, score: result.opponent.score, color: "text-muted-foreground" },
          ].map((item, i) =>
            item ? (
              <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <PlayerAvatar player={item.player} className="size-14" />
                <div className="max-w-full truncate text-sm font-medium">{item.player.name}</div>
                <div className={cn("font-mono text-5xl font-bold tabular-nums", item.color)}>
                  <AnimatedNumber from={0} to={item.score} delay={0.4} />
                </div>
              </div>
            ) : (
              <span key={i} className="text-muted-foreground text-2xl font-black italic">
                {t.common.vs}
              </span>
            ),
          )}
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
        className="grid w-full gap-4 sm:grid-cols-3"
      >
        <Card className="items-center gap-1 py-5">
          <span className="text-muted-foreground text-xs">{t.result.newRating}</span>
          <span className="text-3xl font-black tabular-nums">
            <AnimatedNumber from={result.you.ratingBefore} to={result.you.ratingAfter} delay={0.8} />
          </span>
          <RatingDelta delta={result.you.delta} />
        </Card>
        <Card className="items-center gap-2 py-5">
          <span className="text-muted-foreground text-xs">{t.result.rank}</span>
          <motion.div
            initial={tierChanged ? { scale: 0 } : false}
            animate={{ scale: 1 }}
            transition={{ delay: 1.4, type: "spring" }}
          >
            <RankBadge rating={result.you.ratingAfter} />
          </motion.div>
          {tierChanged && (
            <span className={cn("flex items-center gap-1 text-xs font-semibold", result.you.delta > 0 ? "text-success" : "text-danger")}>
              <ArrowUpRight className={cn("size-3", result.you.delta < 0 && "rotate-90")} />
              {result.you.delta > 0 ? t.result.promoted : t.result.demoted}
            </span>
          )}
        </Card>
        <Card className="items-center gap-1 py-5">
          <span className="text-muted-foreground text-xs">{t.result.accuracy}</span>
          <span className="text-3xl font-black tabular-nums">{accuracy}%</span>
          <span className="text-muted-foreground text-xs">
            {fmt(t.result.correctOf, { score: result.you.score, answered: result.you.answered })}
          </span>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-center"
      >
        {cooldown > 0 ? (
          <>
            <Button size="lg" variant="secondary" disabled className="font-mono tabular-nums">
              <Clock /> {fmt(t.result.nextDuelIn, { time: formatCountdown(cooldown) })}
            </Button>
            <Button size="lg" onClick={() => navigate("/pro")}>
              <Crown /> {t.result.proUnlimited}
            </Button>
          </>
        ) : (
          <Button size="lg" onClick={() => joinQueue(DEFAULT_MODE)}>
            <RotateCcw /> {t.result.nextDuel}
          </Button>
        )}
        <Button
          size="lg"
          variant="outline"
          onClick={() => {
            reset();
            navigate("/stats");
          }}
        >
          <BarChart3 /> {t.result.stats}
        </Button>
      </motion.div>
    </motion.div>
  );
}
