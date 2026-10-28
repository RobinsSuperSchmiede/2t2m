import { getTier, TIERS, tierProgress, type PublicPlayer, type Tier, type TierId } from "@2t2m/shared";
import { Crown, Shield } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";
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

const tierIcon = (id: TierId) => (id === "master" || id === "grandmaster" ? Crown : Shield);

/** Mit `showTiers` öffnet ein Klick die Übersicht aller Ränge. */
export function RankBadge({
  rating,
  className,
  showRating = true,
  showTiers = false,
}: {
  rating: number;
  className?: string;
  showRating?: boolean;
  showTiers?: boolean;
}) {
  const { t } = useI18n();
  const tier = getTier(rating);
  const Icon = tierIcon(tier.id);
  const badgeClass = cn(
    "tier-badge inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium",
    `tier-${tier.id}`,
    className,
  );
  const content = (
    <>
      <Icon className="size-3.5" />
      {t.tiers[tier.id]}
      {showRating && <span className="font-mono opacity-75">{rating}</span>}
    </>
  );
  if (!showTiers) return <span className={badgeClass}>{content}</span>;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={cn(badgeClass, "cursor-pointer transition-[filter] hover:brightness-125")} title={t.ranks.title}>
          {content}
        </button>
      </DialogTrigger>
      <RankOverview rating={rating} />
    </Dialog>
  );
}

function tierRange(tier: Tier, t: ReturnType<typeof useI18n>["t"], fmt: ReturnType<typeof useI18n>["fmt"]) {
  if (!Number.isFinite(tier.min)) return fmt(t.ranks.below, { points: tier.next! });
  if (tier.next === null) return fmt(t.ranks.from, { points: tier.min });
  return `${tier.min} – ${tier.next - 1}`;
}

function RankOverview({ rating }: { rating: number }) {
  const { t, fmt } = useI18n();
  const current = getTier(rating);
  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{t.ranks.title}</DialogTitle>
        <DialogDescription>{t.ranks.description}</DialogDescription>
      </DialogHeader>
      <ol className="flex flex-col-reverse gap-1.5">
        {TIERS.map((tier) => {
          const Icon = tierIcon(tier.id);
          const active = tier.id === current.id;
          return (
            <li
              key={tier.id}
              aria-current={active || undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2.5",
                `tier-${tier.id}`,
                active ? "border-[var(--tier)] bg-[color-mix(in_oklch,var(--tier)_10%,transparent)]" : "border-transparent",
              )}
            >
              <span className={cn("tier-badge grid size-8 shrink-0 place-items-center rounded-md border", `tier-${tier.id}`)}>
                <Icon className="size-4" />
              </span>
              <span className="flex-1 font-medium text-[var(--tier)]">{t.tiers[tier.id]}</span>
              {active && <span className="rounded bg-[var(--tier)] px-1.5 py-0.5 text-[10px] font-semibold text-background uppercase">{t.common.you}</span>}
              <span className="text-muted-foreground w-28 text-right font-mono text-sm tabular-nums">{tierRange(tier, t, fmt)}</span>
            </li>
          );
        })}
      </ol>
      <TierProgress rating={rating} />
    </DialogContent>
  );
}

export function TierProgress({ rating }: { rating: number }) {
  const { t, fmt } = useI18n();
  const tier = getTier(rating);
  return (
    <div className={cn("space-y-1.5", `tier-${tier.id}`)}>
      <Progress value={tierProgress(rating) * 100} className="h-2 [&>*]:bg-[var(--tier)]" />
      <p className="text-muted-foreground text-xs">
        {tier.next === null ? t.tier.maxReached : fmt(t.tier.pointsToNext, { points: tier.next - rating })}
      </p>
    </div>
  );
}
