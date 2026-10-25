import { getTier, tierProgress, type PublicPlayer } from "@2t2m/shared";
import { Crown, Shield } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function PlayerAvatar({
  player,
  className,
}: {
  player: Pick<PublicPlayer, "name" | "avatarUrl">;
  className?: string;
}) {
  return (
    <Avatar className={className}>
      {player.avatarUrl && <AvatarImage src={player.avatarUrl} alt={player.name} referrerPolicy="no-referrer" />}
      <AvatarFallback className="bg-muted font-semibold">
        {initials(player.name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function RankBadge({ rating, className, showRating = true }: { rating: number; className?: string; showRating?: boolean }) {
  const tier = getTier(rating);
  const Icon = tier.id === "master" || tier.id === "grandmaster" ? Crown : Shield;
  return (
    <span
      className={cn(
        "text-foreground inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      <Icon className="size-3.5" />
      {tier.name}
      {showRating && <span className="text-muted-foreground font-mono">{rating}</span>}
    </span>
  );
}

export function TierProgress({ rating }: { rating: number }) {
  const tier = getTier(rating);
  return (
    <div className="space-y-1.5">
      <Progress value={tierProgress(rating) * 100} className="h-2" />
      <p className="text-muted-foreground text-xs">
        {tier.next === null ? "Höchste Stufe erreicht" : `${tier.next - rating} Punkte bis zur nächsten Stufe`}
      </p>
    </div>
  );
}
