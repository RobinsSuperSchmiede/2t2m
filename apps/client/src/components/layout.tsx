import { NavLink, Outlet, useLocation, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import { DEFAULT_MODE, LANGUAGES, type Lang } from "@2t2m/shared";
import { BarChart3, Crown, Globe, History, LogIn, LogOut, Moon, Settings, Sun, Swords, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AdRail, useShowAds } from "@/components/ads";
import { Backdrop } from "@/components/backdrop";
import { PlayerAvatar, RankBadge } from "@/components/player";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useDuel } from "@/lib/duel";
import { LANGUAGE_NAMES, useI18n, type Dict } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

type NavKey = keyof Dict["nav"];

const NAV: { to: string; label: NavKey; short: NavKey; icon: typeof Swords; end: boolean }[] = [
  { to: "/", label: "play", short: "play", icon: Swords, end: true },
  { to: "/stats", label: "stats", short: "statsShort", icon: BarChart3, end: false },
  { to: "/history", label: "history", short: "history", icon: History, end: false },
  { to: "/leaderboard", label: "leaderboard", short: "leaderboardShort", icon: Trophy, end: false },
  { to: "/pro", label: "pro", short: "pro", icon: Crown, end: false },
];

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("logo-shimmer text-xl font-bold tracking-tight", className)}>2T2M Battle</span>
  );
}

/** Hell/Dunkel und Sprache – im Profil-Menü bzw. ohne Anmeldung im Einstellungs-Menü. */
function PreferenceItems() {
  const { theme, toggleTheme } = useTheme();
  const { lang, setLang, t } = useI18n();
  return (
    <>
      {/* Menü bleibt beim Umschalten offen, damit man den Unterschied direkt sieht */}
      <DropdownMenuItem onSelect={(e) => (e.preventDefault(), toggleTheme())}>
        {theme === "dark" ? <Sun /> : <Moon />}
        {theme === "dark" ? t.header.lightMode : t.header.darkMode}
      </DropdownMenuItem>
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <Globe />
          <span className="flex-1">{t.header.language}</span>
          <span className="text-muted-foreground text-xs uppercase">{lang}</span>
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuRadioGroup value={lang} onValueChange={(l) => setLang(l as Lang)}>
            {LANGUAGES.map((l) => (
              <DropdownMenuRadioItem key={l} value={l}>
                {LANGUAGE_NAMES[l]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  );
}

function UserMenu() {
  const { user, logout, requireLogin } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const dashboard = useQuery({
    queryKey: ["dashboard", DEFAULT_MODE],
    queryFn: () => api.dashboard(DEFAULT_MODE),
    enabled: Boolean(user),
  });

  if (!user) {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={t.header.settings}>
              <Settings />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <PreferenceItems />
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" onClick={() => requireLogin()}>
          <LogIn /> {t.header.login}
        </Button>
      </>
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
          <Crown /> {t.header.getPro}
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full" aria-label={t.header.account}>
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
            <Crown /> {user.pro ? t.header.manageSubscription : t.header.getPro}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <PreferenceItems />
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => void logout().then(() => navigate("/"))}>
            <LogOut /> {t.header.logout}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

export function AppLayout() {
  const { state } = useDuel();
  const showAds = useShowAds();
  const { pathname } = useLocation();
  const { t } = useI18n();
  const inGame = state.phase === "intro" || state.phase === "playing";

  return (
    <div className="min-h-svh overflow-x-clip">
      {/* Während des Duells ausgeblendet, damit nichts von Flagge/Umriss ablenkt */}
      <AnimatePresence>{pathname === "/" && !inGame && <Backdrop key="backdrop" />}</AnimatePresence>
      <header
        className={cn(
          "sticky top-0 z-40 transition-opacity",
          inGame && "pointer-events-none opacity-40",
        )}
      >
        {/* Hintergrund läuft nach unten weich aus – keine harte Kante zum Inhalt */}
        <div
          aria-hidden
          className="from-background via-background/85 pointer-events-none absolute inset-x-0 top-0 -bottom-6 bg-gradient-to-b to-transparent"
        />
        <div className="relative grid h-14 grid-cols-[1fr_auto] items-center gap-4 px-4 md:h-16 md:grid-cols-[1fr_auto_1fr] md:px-6">
          <NavLink to="/" aria-label={t.header.home} className="justify-self-start">
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
                {t.nav[label]}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-1 justify-self-end sm:gap-2">
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
                {t.nav[short]}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
