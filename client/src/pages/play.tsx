import { AnimatePresence, motion } from "motion/react";
import { DEFAULT_MODE, MODES } from "@2t2m/shared";
import { Swords, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GameView } from "@/components/duel/game-view";
import { ResultView } from "@/components/duel/result-view";
import { SearchingView } from "@/components/duel/searching";
import { VersusIntro } from "@/components/duel/versus-intro";
import { useDuel } from "@/lib/duel";

function IdleView() {
  const { joinQueue, state } = useDuel();
  return (
    <motion.div
      key="idle"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="flex min-h-[60svh] flex-col items-center justify-center gap-6 text-center"
    >
      <div className="bg-muted grid size-16 place-items-center rounded-xl border">
        <Swords className="size-7" />
      </div>
      <div>
        <h1 className="text-3xl font-bold">{MODES[DEFAULT_MODE].name}</h1>
        <p className="text-muted-foreground mx-auto mt-2 max-w-md">{MODES[DEFAULT_MODE].description}</p>
      </div>
      <Button size="lg" disabled={!state.connected} onClick={() => joinQueue(DEFAULT_MODE)}>
        <Swords /> Ranked-Duell suchen
      </Button>
      {!state.connected && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <WifiOff className="size-4" /> Verbinde mit Server…
        </p>
      )}
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
