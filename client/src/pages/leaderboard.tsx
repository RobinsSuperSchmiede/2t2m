import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { DEFAULT_MODE } from "@2t2m/shared";
import { Crown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InlineAd } from "@/components/ads";
import { PlayerAvatar, RankBadge } from "@/components/player";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const PODIUM = ["text-foreground", "text-muted-foreground", "text-muted-foreground"];

export function LeaderboardPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", DEFAULT_MODE],
    queryFn: () => api.leaderboard(DEFAULT_MODE),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{t.leaderboard.title}</h1>
        <p className="text-muted-foreground mt-1">{t.leaderboard.subtitle}</p>
      </div>

      {data && data.length >= 3 && (
        <div className="grid grid-cols-3 items-end gap-2 sm:gap-3">
          {[1, 0, 2].map((i, pos) => {
            const entry = data[i]!;
            return (
              <motion.div
                key={entry.player.id}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: pos * 0.1, type: "spring", bounce: 0.35 }}
              >
                <Card className={cn("items-center gap-3 text-center", i === 0 ? "py-8" : "py-5")}>
                  <Crown className={cn("size-6", PODIUM[i])} />
                  <PlayerAvatar player={entry.player} className={i === 0 ? "size-12 sm:size-16" : "size-10 sm:size-12"} />
                  <div className="px-2">
                    <div className="truncate font-semibold">{entry.player.name}</div>
                    <RankBadge rating={entry.player.rating} className="mt-1 hidden sm:inline-flex" />
                    <div className="text-muted-foreground font-mono text-xs sm:hidden">{entry.player.rating}</div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t.leaderboard.allPlayers}</CardTitle>
          <CardDescription>{t.leaderboard.allPlayersHint}</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">#</TableHead>
                  <TableHead>{t.leaderboard.player}</TableHead>
                  <TableHead className="hidden sm:table-cell">{t.leaderboard.rank}</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">{t.leaderboard.duels}</TableHead>
                  <TableHead className="text-right">{t.leaderboard.wins}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.map((e) => (
                  <TableRow key={e.player.id} className={cn(e.player.id === user?.id && "bg-muted/60 hover:bg-muted")}>
                    <TableCell className={cn("font-mono font-semibold", PODIUM[e.rank - 1])}>{e.rank}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <PlayerAvatar player={e.player} className="size-7" />
                        <div className="min-w-0">
                          <div className="max-w-40 truncate font-medium sm:max-w-none">{e.player.name}</div>
                          <div className="text-muted-foreground font-mono text-xs sm:hidden">{e.player.rating}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <RankBadge rating={e.player.rating} />
                    </TableCell>
                    <TableCell className="hidden text-right tabular-nums sm:table-cell">{e.games}</TableCell>
                    <TableCell className="text-right tabular-nums">{Math.round((e.wins / e.games) * 100)}%</TableCell>
                  </TableRow>
                ))}
                {data?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                      {t.leaderboard.empty}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <InlineAd />
    </div>
  );
}
