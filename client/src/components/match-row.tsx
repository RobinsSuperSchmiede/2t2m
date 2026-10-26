import type { MatchHistoryItem, Outcome } from "@2t2m/shared";
import { Badge } from "@/components/ui/badge";
import { PlayerAvatar } from "@/components/player";
import { cn } from "@/lib/utils";

export const OUTCOME_LABEL: Record<Outcome, string> = { win: "Sieg", loss: "Niederlage", draw: "Unentschieden" };
const OUTCOME_SHORT: Record<Outcome, string> = { win: "S", loss: "N", draw: "U" };

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "w-8 justify-center sm:w-28",
        outcome === "win" && "border-success/40 bg-success/10 text-success",
        outcome === "loss" && "border-danger/40 bg-danger/10 text-danger",
      )}
    >
      <span className="sm:hidden">{OUTCOME_SHORT[outcome]}</span>
      <span className="hidden sm:inline">{OUTCOME_LABEL[outcome]}</span>
    </Badge>
  );
}

export function RatingDelta({ delta, className }: { delta: number; className?: string }) {
  return (
    <span
      className={cn(
        "font-mono font-semibold tabular-nums",
        delta > 0 ? "text-success" : delta < 0 ? "text-danger" : "text-muted-foreground",
        className,
      )}
    >
      {delta > 0 ? "+" : ""}
      {delta}
    </span>
  );
}

const relative = new Intl.RelativeTimeFormat("de", { numeric: "auto" });

export function timeAgo(iso: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, size] of steps) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return "gerade eben";
}

export function MatchRow({ match }: { match: MatchHistoryItem }) {
  return (
    <div className="hover:bg-accent/40 flex items-center gap-3 rounded-lg px-2 py-3 transition-colors sm:gap-4 sm:px-3">
      <OutcomeBadge outcome={match.outcome} />
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <PlayerAvatar player={match.opponent} className="hidden size-8 sm:flex" />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{match.opponent.name}</div>
          <div className="text-muted-foreground text-xs">
            {timeAgo(match.endedAt)}
            {match.forfeit && " · Aufgegeben"}
          </div>
        </div>
      </div>
      <div className="font-mono text-sm font-semibold tabular-nums">
        <span className={cn(match.outcome === "win" && "text-success")}>{match.score}</span>
        <span className="text-muted-foreground mx-1.5">:</span>
        <span className={cn(match.outcome === "loss" && "text-danger")}>{match.opponentScore}</span>
      </div>
      <RatingDelta delta={match.delta} className="w-10 text-right text-sm sm:w-12" />
    </div>
  );
}
