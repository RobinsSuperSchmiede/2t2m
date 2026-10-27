import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { matchmakingRange } from "@2t2m/shared";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlayerAvatar, RankBadge } from "@/components/player";
import { useAuth } from "@/lib/auth";
import { useDuel, useServerClock } from "@/lib/duel";
import { useI18n } from "@/lib/i18n";

function formatWait(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function SearchingView() {
  const { user } = useAuth();
  const { state, leaveQueue } = useDuel();
  const { t, fmt } = useI18n();
  const tips = t.searching.tips;
  const now = useServerClock(250);
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTip((i) => (i + 1) % tips.length), 4500);
    return () => clearInterval(id);
  }, [tips.length]);

  const queue = state.queue;
  const waited = queue ? Math.max(0, now - queue.since) : 0;

  return (
    <motion.div
      key="searching"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05, filter: "blur(8px)" }}
      className="flex min-h-[70svh] flex-col items-center justify-center gap-10 text-center"
    >
      <div className="relative grid size-64 place-items-center">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="border-foreground/20 absolute inset-0 rounded-full border"
            initial={{ scale: 0.35, opacity: 0.9 }}
            animate={{ scale: 1.15, opacity: 0 }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }}
          />
        ))}
        <div className="bg-background relative rounded-full border p-1.5">
          {user && <PlayerAvatar player={user} className="size-24 text-2xl" />}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="flex items-center justify-center gap-2 text-2xl font-bold">
          <Loader2 className="text-muted-foreground size-5 animate-spin" /> {t.searching.title}
        </h2>
        <div className="text-muted-foreground flex items-center justify-center gap-3 text-sm">
          <span className="font-mono text-foreground text-lg tabular-nums">{formatWait(waited)}</span>
          {queue && (
            <>
              <span>·</span>
              <RankBadge rating={queue.rating} />
              <span>·</span>
              <span>{fmt(t.searching.range, { range: matchmakingRange(waited) })}</span>
            </>
          )}
        </div>
        <motion.p
          key={tip}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-muted-foreground mx-auto max-w-sm text-sm"
        >
          {tips[tip]}
        </motion.p>
      </div>

      <Button variant="outline" onClick={leaveQueue}>
        <X /> {t.searching.cancel}
      </Button>
    </motion.div>
  );
}
