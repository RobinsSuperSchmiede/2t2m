import { NavLink, Outlet, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_MODE } from "@2t2m/shared";
import { BarChart3, Crown, History, LogIn, LogOut, Swords, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdRail, useShowAds } from "@/components/ads";
import { PlayerAvatar, RankBadge } from "@/components/player";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDuel } from "@/lib/duel";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Spielen", short: "Spielen", icon: Swords, end: true },
  { to: "/stats", label: "Statistiken", short: "Statistik", icon: BarChart3, end: false },
  { to: "/history", label: "Verlauf", short: "Verlauf", icon: History, end: false },
  { to: "/leaderboard", label: "Rangliste", short: "Rangliste", icon: Trophy, end: false },
  { to: "/pro", label: "Pro", short: "Pro", icon: Crown, end: false },
];

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 font-bold tracking-tight", className)}>
      <span className="bg-primary text-primary-foreground grid size-8 place-items-center rounded-lg">
        <Swords className="size-4" />
      </span>
      <span>
        2T2M<span className="text-muted-foreground hidden font-medium sm:inline"> Arena</span>
      </span>
    </span>
  );
}

function UserMenu() {
  const { user, logout, requireLogin } = useAuth();
  const navigate = useNavigate();
  const dashboard = useQuery({
    queryKey: ["dashboard", DEFAULT_MODE],
    queryFn: () => api.dashboard(DEFAULT_MODE),
    enabled: Boolean(user),
  });

  if (!user) {
    return (
      <Button size="sm" onClick={() => requireLogin()}>
        <LogIn /> Anmelden
      </Button>
    );
  }

  return (
    <>
      {dashboard.data && <RankBadge rating={dashboard.data.stats.rating} className="hidden sm:inline-flex" />}
      {user.pro ? (
        <Badge variant="secondary" className="gap-1">
          <Crown className="size-3" /> Pro
        </Badge>
      ) : (
        <Button size="sm" variant="outline" className="hidden sm:inline-flex" onClick={() => navigate("/pro")}>
          <Crown /> Pro holen
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label="Konto">
            <PlayerAvatar player={user} className="size-8" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="font-medium">{user.name}</div>
            <div className="text-muted-foreground truncate text-xs font-normal">{user.email}</div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => navigate("/pro")}>
            <Crown /> {user.pro ? "Abo verwalten" : "Pro holen"}
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => void logout().then(() => navigate("/"))}>
            <LogOut /> Abmelden
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export function AppLayout() {
  const { state } = useDuel();
  const showAds = useShowAds();
  const inGame = state.phase === "intro" || state.phase === "playing";

  return (
    <div className="min-h-svh overflow-x-clip">
      <header
        className={cn(
          "bg-background/80 sticky top-0 z-40 border-b backdrop-blur transition-opacity",
          inGame && "pointer-events-none opacity-40",
        )}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 md:h-16 md:gap-6">
          <NavLink to="/" aria-label="Startseite">
            <Logo />
          </NavLink>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "text-muted-foreground hover:text-foreground flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    isActive && "bg-accent text-foreground",
                  )
                }
              >
                <Icon className="size-4" />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1560px] gap-6 px-4">
        {showAds && <AdRail />}
        <main className={cn("min-w-0 flex-1 py-6 md:py-8", !inGame && "pb-24 md:pb-8")}>
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
        {showAds && <AdRail />}
      </div>

      {/* Tab-Leiste für Smartphones – während des Duells ausgeblendet */}
      {!inGame && (
        <nav className="bg-background/95 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          <div className="grid grid-cols-5">
            {NAV.map(({ to, short, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "text-muted-foreground flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                    isActive && "text-foreground",
                  )
                }
              >
                <Icon className="size-5" />
                {short}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
