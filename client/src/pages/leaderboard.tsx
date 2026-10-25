import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { DEFAULT_MODE } from "@2t2m/shared";
import { Crown } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlayerAvatar, RankBadge } from "@/components/player";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const PODIUM = ["text-amber-300", "text-zinc-300", "text-orange-400"];

export function LeaderboardPage() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard", DEFAULT_MODE],
    queryFn: () => api.leaderboard(DEFAULT_MODE),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Rangliste</h1>
        <p className="text-muted-foreground mt-1">Die besten 100 Spieler in Flaggen & Umrisse.</p>
      </div>

      {data && data.length >= 3 && (
        <div className="grid grid-cols-3 items-end gap-3">
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
                  <PlayerAvatar player={entry.player} className={i === 0 ? "size-16" : "size-12"} />
                  <div className="px-2">
                    <div className="truncate font-semibold">{entry.player.name}</div>
                    <RankBadge rating={entry.player.rating} className="mt-1" />
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Alle Spieler</CardTitle>
          <CardDescription>Nur Spieler mit mindestens einem Duell</CardDescription>
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
                  <TableHead>Spieler</TableHead>
                  <TableHead>Rang</TableHead>
                  <TableHead className="text-right">Duelle</TableHead>
                  <TableHead className="text-right">Siegquote</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.map((e) => (
                  <TableRow key={e.player.id} className={cn(e.player.id === user?.id && "bg-primary/10 hover:bg-primary/15")}>
                    <TableCell className={cn("font-mono font-semibold", PODIUM[e.rank - 1])}>{e.rank}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <PlayerAvatar player={e.player} className="size-7" />
                        <span className="font-medium">{e.player.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <RankBadge rating={e.player.rating} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{e.games}</TableCell>
                    <TableCell className="text-right tabular-nums">{Math.round((e.wins / e.games) * 100)}%</TableCell>
                  </TableRow>
                ))}
                {data?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                      Noch niemand hat gespielt – sei der Erste!
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
