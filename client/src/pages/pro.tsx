import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { PRO_PRICE_LABEL } from "@2t2m/shared";
import { BarChart3, Check, Crown, Infinity as InfinityIcon, Loader2, Minus, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const BENEFITS = [
  { icon: InfinityIcon, title: "Unbegrenzte Spielzeit", text: "Spiele so viele Duelle hintereinander, wie du willst." },
  { icon: BarChart3, title: "Detaillierte Statistiken", text: "Rating-Verlauf, Antwortzeit, Fragetypen und deine schwächsten Länder." },
  { icon: ShieldOff, title: "Komplett werbefrei", text: "Keine Anzeigen – nirgends." },
];

const COMPARISON: { label: string; free: string | boolean; pro: string | boolean }[] = [
  { label: "Ranked-Duelle", free: "1 pro Stunde", pro: "Unbegrenzt" },
  { label: "Rating, Rang & Verlauf", free: true, pro: true },
  { label: "Detaillierte Statistiken", free: false, pro: true },
  { label: "Werbefrei", free: false, pro: true },
];

const dateFormat = new Intl.DateTimeFormat("de-DE", { dateStyle: "long" });

function Cell({ value }: { value: string | boolean }) {
  if (value === true) return <Check className="mx-auto size-4" />;
  if (value === false) return <Minus className="text-muted-foreground mx-auto size-4" />;
  return <span>{value}</span>;
}

export function ProPage() {
  const { user, requireLogin, setUser } = useAuth();
  const config = useQuery({ queryKey: ["auth-config"], queryFn: api.authConfig, staleTime: Infinity });
  const [params, setParams] = useSearchParams();
  const [syncing, setSyncing] = useState(false);
  const synced = useRef(false);

  // Rückkehr vom Stripe-Checkout: Abo sofort abgleichen, statt auf den Webhook zu warten.
  useEffect(() => {
    const status = params.get("checkout");
    const sessionId = params.get("session_id");
    if (!status || !user || synced.current) return;
    synced.current = true;
    if (status === "cancel") {
      toast("Checkout abgebrochen – es wurde nichts berechnet.");
      setParams({}, { replace: true });
      return;
    }
    if (status === "success" && sessionId) {
      setSyncing(true);
      api
        .syncCheckout(sessionId)
        .then((u) => {
          setUser(u);
          if (u.pro) toast.success("Willkommen bei Pro!");
          else toast("Zahlung eingegangen – Pro wird in Kürze aktiviert.");
        })
        .catch((err: Error) => toast.error(err.message))
        .finally(() => {
          setSyncing(false);
          setParams({}, { replace: true });
        });
    }
  }, [params, user, setParams, setUser]);

  const checkout = useMutation({
    mutationFn: api.checkout,
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (err: Error) => toast.error(err.message),
  });
  const portal = useMutation({
    mutationFn: api.portal,
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (err: Error) => toast.error(err.message),
  });
  const devToggle = useMutation({
    mutationFn: api.devTogglePro,
    onSuccess: (u) => setUser(u),
    onError: (err: Error) => toast.error(err.message),
  });

  const stripeEnabled = config.data?.stripeEnabled ?? false;
  const sub = user?.subscription;
  const busy = checkout.isPending || portal.isPending || syncing;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-2 text-center">
        <Badge variant="outline" className="gap-1">
          <Crown className="size-3" /> 2T2M Pro
        </Badge>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Spiel ohne Grenzen</h1>
        <p className="text-muted-foreground">Unbegrenzt duellieren, tiefer analysieren, keine Werbung.</p>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-baseline gap-1">
              <span className="text-4xl font-bold">{PRO_PRICE_LABEL}</span>
              <span className="text-muted-foreground text-base font-normal">/ Monat</span>
            </CardTitle>
            <CardDescription>Monatlich kündbar · sichere Zahlung über Stripe</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {BENEFITS.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3">
                <div className="bg-muted grid size-9 shrink-0 place-items-center rounded-md border">
                  <Icon className="size-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">{title}</div>
                  <div className="text-muted-foreground text-sm">{text}</div>
                </div>
              </div>
            ))}
          </CardContent>
          <CardFooter className="flex-col items-stretch gap-3">
            {!user ? (
              <Button size="lg" onClick={() => requireLogin()}>
                Anmelden & Pro holen
              </Button>
            ) : user.pro ? (
              <>
                <div className="bg-muted/50 rounded-md border p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <Check className="text-success size-4" /> Pro ist aktiv
                  </div>
                  {sub?.periodEnd && (
                    <div className="text-muted-foreground mt-1">
                      {sub.cancelAtPeriodEnd ? "Endet am " : "Verlängert sich am "}
                      {dateFormat.format(new Date(sub.periodEnd))}
                    </div>
                  )}
                </div>
                <Button size="lg" variant="outline" disabled={!stripeEnabled || busy} onClick={() => portal.mutate()}>
                  {portal.isPending && <Loader2 className="animate-spin" />}
                  Abo verwalten oder kündigen
                </Button>
              </>
            ) : (
              <Button size="lg" disabled={!stripeEnabled || busy} onClick={() => checkout.mutate()}>
                {busy ? <Loader2 className="animate-spin" /> : <Crown />}
                {syncing ? "Zahlung wird geprüft…" : `Pro holen · ${PRO_PRICE_LABEL}/Monat`}
              </Button>
            )}
            {config.data && !stripeEnabled && (
              <p className="text-muted-foreground text-center text-xs">
                Zahlungen sind noch nicht eingerichtet (<code className="font-mono">STRIPE_SECRET_KEY</code> fehlt).
              </p>
            )}
            {user && config.data?.devLogin && (
              <Button variant="ghost" size="sm" disabled={devToggle.isPending} onClick={() => devToggle.mutate()}>
                Dev: Pro {user.pro ? "deaktivieren" : "aktivieren"} (ohne Zahlung)
              </Button>
            )}
          </CardFooter>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Free vs. Pro</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-3 text-sm">
              <span />
              <span className="text-muted-foreground w-16 text-center text-xs font-medium uppercase">Free</span>
              <span className="w-16 text-center text-xs font-medium uppercase">Pro</span>
              {COMPARISON.map((row) => (
                <div key={row.label} className="contents">
                  <span>{row.label}</span>
                  <span className={cn("text-muted-foreground w-16 text-center text-xs")}>
                    <Cell value={row.free} />
                  </span>
                  <span className="w-16 text-center text-xs font-medium">
                    <Cell value={row.pro} />
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
