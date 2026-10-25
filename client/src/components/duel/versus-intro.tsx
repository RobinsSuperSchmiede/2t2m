import { AnimatePresence, motion } from "motion/react";
import type { PublicPlayer } from "@2t2m/shared";
import { PlayerAvatar, RankBadge } from "@/components/player";
import { useDuel, useServerClock } from "@/lib/duel";
import { cn } from "@/lib/utils";

function PlayerCard({ player, side, label }: { player: PublicPlayer; side: "left" | "right"; label: string }) {
  const fromX = side === "left" ? -400 : 400;
  return (
    <motion.div
      initial={{ x: fromX, opacity: 0, skewX: side === "left" ? -12 : 12 }}
      animate={{ x: 0, opacity: 1, skewX: 0 }}
      transition={{ type: "spring", stiffness: 140, damping: 16, delay: side === "left" ? 0.1 : 0.25 }}
      className={cn("flex flex-1 flex-col items-center gap-4", side === "left" ? "md:items-end" : "md:items-start")}
    >
      <div
        className={cn(
          "relative rounded-full border p-1.5",
        )}
      >
        <PlayerAvatar player={player} className="size-28 text-3xl md:size-36" />
      </div>
      <div className={cn("text-center", side === "left" ? "md:text-right" : "md:text-left")}>
        <div className="text-muted-foreground text-xs font-medium tracking-[0.3em] uppercase">
          {label}
        </div>
        <div className="mt-1 max-w-56 truncate text-2xl font-bold">{player.name}</div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }} className="mt-2">
          <RankBadge rating={player.rating} />
        </motion.div>
      </div>
    </motion.div>
  );
}

export function VersusIntro() {
  const { state } = useDuel();
  const now = useServerClock(50);
  const match = state.match!;
  const remaining = match.startsAt - now;
  const countdown = remaining <= 3000 ? Math.max(1, Math.ceil(remaining / 1000)) : null;

  return (
    <motion.div
      key="intro"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
      transition={{ duration: 0.35 }}
      className="relative flex min-h-[75svh] flex-col items-center justify-center overflow-hidden"
    >
      <div className="text-muted-foreground mb-10 text-sm font-semibold tracking-[0.4em] uppercase">
        <motion.span initial={{ opacity: 0, letterSpacing: "1em" }} animate={{ opacity: 1, letterSpacing: "0.4em" }}>
          Gegner gefunden
        </motion.span>
      </div>

      <div className="flex w-full max-w-4xl flex-col items-center gap-8 md:flex-row md:gap-4">
        <PlayerCard player={match.you} side="left" label="Du" />
        <motion.div
          initial={{ scale: 4, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.55 }}
          className="relative shrink-0 px-6"
        >
          <span className="text-6xl font-black italic md:text-7xl">
            VS
          </span>
        </motion.div>
        <PlayerCard player={match.opponent} side="right" label="Gegner" />
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="text-muted-foreground mt-10 text-center text-sm"
      >
        60 Sekunden · Flaggen & Umrisse · wer mehr richtig hat, gewinnt
      </motion.p>

      <div className="mt-4 grid h-28 place-items-center">
        <AnimatePresence mode="popLayout">
          {countdown !== null && (
            <motion.div
              key={countdown}
              initial={{ scale: 2.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
              className="text-8xl font-black tabular-nums"
            >
              {countdown}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
