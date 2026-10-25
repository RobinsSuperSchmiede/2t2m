import { NavLink, Outlet, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_MODE } from "@2t2m/shared";
import { History, LayoutDashboard, LogOut, Swords, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PlayerAvatar, RankBadge } from "@/components/player";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDuel } from "@/lib/duel";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/play", label: "Spielen", icon: Swords, end: false },
  { to: "/history", label: "Verlauf", icon: History, end: false },
  { to: "/leaderboard", label: "Rangliste", icon: Trophy, end: false },
];

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2 font-bold tracking-tight", className)}>
      <span className="bg-primary/15 text-primary ring-primary/30 grid size-8 place-items-center rounded-lg ring-1">
        <Swords className="size-4" />
      </span>
      <span>
        2T2M<span className="text-muted-foreground font-medium"> Arena</span>
      </span>
    </span>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth();
  const { state } = useDuel();
  const navigate = useNavigate();
  const dashboard = useQuery({ queryKey: ["dashboard", DEFAULT_MODE], queryFn: () => api.dashboard(DEFAULT_MODE) });
  const inGame = state.phase === "intro" || state.phase === "playing";

  return (
    <div className="app-bg min-h-svh overflow-x-clip">
      <header
        className={cn(
          "bg-background/70 sticky top-0 z-40 border-b backdrop-blur-xl transition-opacity",
          inGame && "pointer-events-none opacity-40",
        )}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4">
          <NavLink to="/">
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
          <div className="ml-auto flex items-center gap-3">
            {dashboard.data && <RankBadge rating={dashboard.data.stats.rating} className="hidden sm:inline-flex" />}
            {user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <PlayerAvatar player={user} className="size-8" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-muted-foreground truncate text-xs font-normal">{user.email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {NAV.map(({ to, label, icon: Icon }) => (
                    <DropdownMenuItem key={to} onClick={() => navigate(to)} className="md:hidden">
                      <Icon /> {label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator className="md:hidden" />
                  <DropdownMenuItem variant="destructive" onClick={() => void logout()}>
                    <LogOut /> Abmelden
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
