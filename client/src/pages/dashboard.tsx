import { Link, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { DEFAULT_MODE, MODES, getTier, type DashboardResponse } from "@2t2m/shared";
import { ArrowRight, BookOpen, Earth, Flag, Flame, Globe2, Lock, Map, Medal, Swords, Target, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { MatchRow } from "@/components/match-row";
import { RankBadge, TierProgress } from "@/components/player";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDuel } from "@/lib/duel";
import { TIER_STYLES } from "@/lib/tiers";
import { cn } from "@/lib/utils";

const UPCOMING = [
  { icon: BookOpen, name: "Geschichte" },
  { icon: Globe2, name: "Hauptstädte" },
  { icon: Medal, name: "Sport" },
];

const chartConfig = { rating: { label: "Rating", color: "var(--chart-1)" } } satisfies ChartConfig;

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  delay,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
  hint?: string;
  delay: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <Card className="gap-2 py-5">
        <CardHeader className="px-5">
          <CardDescription className="flex items-center gap-2">
            <Icon className="size-4" /> {label}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-5">
          <div className="text-2xl font-bold tabular-nums">{value}</div>
          {hint && <div className="text-muted-foreground mt-0.5 text-xs">{hint}</div>}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function RatingChart({ data }: { data: DashboardResponse["ratingHistory"] }) {
  if (data.length < 2) {
    return (
      <div className="text-muted-foreground grid h-56 place-items-center text-sm">
        Spiele ein paar Duelle, um deinen Verlauf zu sehen.
      </div>
    );
  }
  const points = data.map((p, i) => ({ ...p, game: i }));
  return (
    <ChartContainer config={chartConfig} className="h-56 w-full">
      <AreaChart data={points} margin={{ left: 0, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="ratingFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-rating)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="var(--color-rating)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="game" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(v) => `#${v}`} />
        <YAxis domain={["dataMin - 20", "dataMax + 20"]} tickLine={false} axisLine={false} width={40} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(_, payload) => {
                const at = payload?.[0]?.payload?.at as string | undefined;
                return at ? new Date(at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : "";
              }}
            />
          }
        />
        <Area
          dataKey="rating"
          type="monotone"
          stroke="var(--color-rating)"
          strokeWidth={2}
          fill="url(#ratingFill)"
          animationDuration={900}
        />
      </AreaChart>
    </ChartContainer>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { joinQueue, state } = useDuel();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", DEFAULT_MODE],
    queryFn: () => api.dashboard(DEFAULT_MODE),
  });

  const play = () => {
    if (state.phase === "idle" || state.phase === "finished") joinQueue(DEFAULT_MODE);
    navigate("/play");
  };

  const stats = data?.stats;
  const tier = stats ? getTier(stats.rating) : null;
  const winrate = stats && stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : null;

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold tracking-tight">Hallo {user?.name.split(" ")[0]} 👋</h1>
        <p className="text-muted-foreground mt-1">Bereit für das nächste Duell?</p>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.div
          className="lg:col-span-2"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card className="relative h-full overflow-hidden">
            <div className="from-primary/25 pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent" />
            <Earth className="text-primary/10 pointer-events-none absolute -right-10 -bottom-12 size-72" strokeWidth={1} />
            <CardHeader className="relative">
              <Badge variant="secondary" className="w-fit">
                Geografie · Ranked
              </Badge>
              <CardTitle className="mt-2 text-2xl">{MODES[DEFAULT_MODE].name}</CardTitle>
              <CardDescription className="max-w-md">{MODES[DEFAULT_MODE].description}</CardDescription>
            </CardHeader>
            <CardContent className="relative flex flex-wrap items-center gap-4">
              <Button size="lg" onClick={play} className="group h-12 px-8 text-base shadow-lg shadow-primary/30">
                <Swords className="transition-transform group-hover:rotate-12" />
                Duell starten
                <ArrowRight className="transition-transform group-hover:translate-x-1" />
              </Button>
              <div className="text-muted-foreground flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <Flag className="size-4" /> Flaggen
                </span>
                <span className="flex items-center gap-1.5">
                  <Map className="size-4" /> Umrisse
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="h-full">
            <CardHeader>
              <CardDescription>Dein Rang</CardDescription>
              {stats && tier ? (
                <>
                  <CardTitle
                    className={cn(
                      "bg-gradient-to-r bg-clip-text text-4xl font-black text-transparent",
                      TIER_STYLES[tier.id].gradient,
                    )}
                  >
                    {stats.rating}
                  </CardTitle>
                  <CardAction>
                    <RankBadge rating={stats.rating} showRating={false} />
                  </CardAction>
                </>
              ) : (
                <Skeleton className="h-10 w-28" />
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {stats && <TierProgress rating={stats.rating} />}
              <div className="text-muted-foreground grid grid-cols-2 gap-2 text-sm">
                <div>
                  Höchstwert <div className="text-foreground font-semibold">{stats?.peakRating ?? "–"}</div>
                </div>
                <div>
                  Globaler Platz <div className="text-foreground font-semibold">{stats?.rank ? `#${stats.rank}` : "–"}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading || !data ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <StatCard
              icon={Trophy}
              label="Siegquote"
              value={winrate !== null ? `${winrate}%` : "–"}
              hint={`${data.stats.wins} S · ${data.stats.losses} N · ${data.stats.draws} U`}
              delay={0.15}
            />
            <StatCard
              icon={Target}
              label="Trefferquote"
              value={data.accuracy !== null ? `${Math.round(data.accuracy * 100)}%` : "–"}
              hint="über alle Antworten"
              delay={0.2}
            />
            <StatCard
              icon={Medal}
              label="Bestleistung"
              value={data.bestScore !== null ? String(data.bestScore) : "–"}
              hint={data.avgScore !== null ? `Ø ${data.avgScore.toFixed(1)} pro Duell` : "richtige in 60 s"}
              delay={0.25}
            />
            <StatCard
              icon={Flame}
              label="Serie"
              value={data.streak.count > 0 ? String(data.streak.count) : "–"}
              hint={
                data.streak.type === "win"
                  ? "Siege in Folge 🔥"
                  : data.streak.type === "loss"
                    ? "Niederlagen in Folge"
                    : data.streak.type === "draw"
                      ? "Unentschieden in Folge"
                      : "noch keine Duelle"
              }
              delay={0.3}
            />
          </>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Rating-Verlauf</CardTitle>
            <CardDescription>Deine letzten {Math.max(0, (data?.ratingHistory.length ?? 1) - 1)} Duelle</CardDescription>
          </CardHeader>
          <CardContent>{data ? <RatingChart data={data.ratingHistory} /> : <Skeleton className="h-56" />}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Stärken</CardTitle>
            <CardDescription>Trefferquote nach Fragetyp</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {data?.kindAccuracy.map((k) => {
              const pct = k.total > 0 ? Math.round((k.correct / k.total) * 100) : 0;
              return (
                <div key={k.kind} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      {k.kind === "flag" ? <Flag className="size-4" /> : <Map className="size-4" />}
                      {k.kind === "flag" ? "Flaggen" : "Umrisse"}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {k.total > 0 ? `${pct}% · ${k.correct}/${k.total}` : "–"}
                    </span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
            <div className="space-y-2 pt-2">
              <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Bald verfügbar</p>
              <div className="flex flex-wrap gap-2">
                {UPCOMING.map(({ icon: Icon, name }) => (
                  <Badge key={name} variant="outline" className="text-muted-foreground gap-1.5">
                    <Icon className="size-3" /> {name} <Lock className="size-3" />
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Letzte Duelle</CardTitle>
          <CardAction>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/history">
                Alle ansehen <ArrowRight />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-3">
          {data?.recentMatches.length ? (
            data.recentMatches.map((m) => <MatchRow key={m.id} match={m} />)
          ) : (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">Noch keine Duelle gespielt.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
