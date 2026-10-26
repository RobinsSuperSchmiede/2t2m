import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { DEFAULT_MODE, type CountryStat, type DashboardDetails, type RatingPoint } from "@2t2m/shared";
import {
  ArrowRight,
  BarChart3,
  Crown,
  Flag,
  Flame,
  Gauge,
  Hash,
  Lock,
  Map,
  Medal,
  Swords,
  Target,
  Trophy,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { InlineAd } from "@/components/ads";
import { AuthGate } from "@/components/auth-gate";
import { MatchRow } from "@/components/match-row";
import { RankBadge, TierProgress } from "@/components/player";
import { api } from "@/lib/api";

const chartConfig = { rating: { label: "Rating", color: "var(--chart-1)" } } satisfies ChartConfig;

function StatCard({ icon: Icon, label, value, hint }: { icon: typeof Trophy; label: string; value: string; hint?: string }) {
  return (
    <Card className="gap-2 py-4 md:py-5">
      <CardHeader className="px-4 md:px-5">
        <CardDescription className="flex items-center gap-2">
          <Icon className="size-4" /> {label}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 md:px-5">
        <div className="text-xl font-bold tabular-nums md:text-2xl">{value}</div>
        {hint && <div className="text-muted-foreground mt-0.5 text-xs">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function RatingChart({ data }: { data: RatingPoint[] }) {
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
            <stop offset="0%" stopColor="var(--color-rating)" stopOpacity={0.25} />
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
        <Area dataKey="rating" type="monotone" stroke="var(--color-rating)" strokeWidth={2} fill="url(#ratingFill)" />
      </AreaChart>
    </ChartContainer>
  );
}

function CountryList({ title, icon: Icon, items, empty }: { title: string; icon: typeof Trophy; items: CountryStat[]; empty: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && <p className="text-muted-foreground text-sm">{empty}</p>}
        {items.map((c) => {
          const pct = Math.round((c.correct / c.total) * 100);
          return (
            <div key={c.code} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-medium">{c.name}</span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {pct}% · {c.correct}/{c.total}
                </span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ProDetails({ details }: { details: DashboardDetails }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatCard
          icon={Target}
          label="Trefferquote"
          value={details.accuracy !== null ? `${Math.round(details.accuracy * 100)}%` : "–"}
          hint="über alle Antworten"
        />
        <StatCard
          icon={Gauge}
          label="Ø Antwortzeit"
          value={details.avgAnswerMs !== null ? `${(details.avgAnswerMs / 1000).toFixed(1)} s` : "–"}
          hint="inkl. Strafzeit"
        />
        <StatCard
          icon={Medal}
          label="Bestleistung"
          value={details.bestScore !== null ? String(details.bestScore) : "–"}
          hint="richtige in 60 s"
        />
        <StatCard
          icon={Hash}
          label="Ø Punkte"
          value={details.avgScore !== null ? details.avgScore.toFixed(1) : "–"}
          hint="pro Duell"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Rating-Verlauf</CardTitle>
            <CardDescription>Deine letzten {Math.max(0, details.ratingHistory.length - 1)} Duelle</CardDescription>
          </CardHeader>
          <CardContent>
            <RatingChart data={details.ratingHistory} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Fragetypen</CardTitle>
            <CardDescription>Trefferquote nach Typ</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {details.kindAccuracy.map((k) => {
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
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <CountryList
          title="Hier patzt du am häufigsten"
          icon={TrendingDown}
          items={details.weakestCountries}
          empty="Noch zu wenige Daten – ein Land braucht mindestens zwei Begegnungen."
        />
        <CountryList
          title="Deine sichersten Länder"
          icon={TrendingUp}
          items={details.strongestCountries}
          empty="Noch zu wenige Daten – ein Land braucht mindestens zwei Begegnungen."
        />
      </div>
    </div>
  );
}

function ProLocked() {
  return (
    <Card className="relative overflow-hidden">
      {/* Angedeuteter Inhalt im Hintergrund */}
      <div aria-hidden className="pointer-events-none grid select-none gap-4 p-6 opacity-40 blur-[3px] md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="bg-muted h-4 w-24 rounded" />
            <div className="bg-muted h-24 rounded" />
          </div>
        ))}
      </div>
      <div className="bg-background/60 absolute inset-0 grid place-items-center p-4">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <div className="bg-card grid size-10 place-items-center rounded-lg border">
            <Lock className="size-4" />
          </div>
          <div>
            <div className="font-semibold">Detaillierte Statistiken mit Pro</div>
            <p className="text-muted-foreground mt-1 text-sm">
              Rating-Verlauf, Trefferquote pro Fragetyp, Antwortzeit und deine schwächsten Länder.
            </p>
          </div>
          <Button asChild>
            <Link to="/pro">
              <Crown /> Pro freischalten
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}

function StatsContent() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard", DEFAULT_MODE],
    queryFn: () => api.dashboard(DEFAULT_MODE),
  });

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const { stats, streak, details } = data;
  const winrate = stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Dein Rating</CardDescription>
            <CardTitle className="text-4xl font-bold tabular-nums">{stats.rating}</CardTitle>
            <CardAction>
              <RankBadge rating={stats.rating} showRating={false} />
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-4">
            <TierProgress rating={stats.rating} />
            <div className="text-muted-foreground grid grid-cols-2 gap-2 text-sm">
              <div>
                Höchstwert <div className="text-foreground font-semibold">{stats.peakRating}</div>
              </div>
              <div>
                Globaler Platz <div className="text-foreground font-semibold">{stats.rank ? `#${stats.rank}` : "–"}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="grid grid-cols-2 gap-3 md:gap-4 lg:col-span-2">
          <StatCard icon={Swords} label="Duelle" value={String(stats.games)} />
          <StatCard
            icon={Trophy}
            label="Siegquote"
            value={winrate !== null ? `${winrate}%` : "–"}
            hint={`${stats.wins} S · ${stats.losses} N · ${stats.draws} U`}
          />
          <StatCard
            icon={Flame}
            label="Serie"
            value={streak.count > 0 ? String(streak.count) : "–"}
            hint={
              streak.type === "win"
                ? "Siege in Folge"
                : streak.type === "loss"
                  ? "Niederlagen in Folge"
                  : streak.type === "draw"
                    ? "Unentschieden in Folge"
                    : "noch keine Duelle"
            }
          />
          <StatCard icon={Medal} label="Höchstes Rating" value={String(stats.peakRating)} />
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          Details <Crown className="text-muted-foreground size-4" />
        </h2>
        {details ? <ProDetails details={details} /> : <ProLocked />}
      </section>

      <InlineAd />

      <Card>
        <CardHeader>
          <CardTitle>Letzte Duelle</CardTitle>
          <CardAction>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/history">
                Alle <ArrowRight />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-2 md:px-3">
          {data.recentMatches.length ? (
            data.recentMatches.map((m) => <MatchRow key={m.id} match={m} />)
          ) : (
            <p className="text-muted-foreground px-3 py-6 text-center text-sm">Noch keine Duelle gespielt.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function StatsPage() {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Statistiken</h1>
        <p className="text-muted-foreground mt-1">Flaggen & Umrisse · Ranked</p>
      </div>
      <AuthGate
        icon={BarChart3}
        title="Deine Statistiken"
        description="Melde dich an, um Rating, Rang und Verlauf zu sehen."
      >
        <StatsContent />
      </AuthGate>
    </motion.div>
  );
}
