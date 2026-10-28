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
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

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
  const { t, fmt, lang, errorText } = useI18n();
  // Toasts im Effekt sollen die aktuelle Sprache nutzen, ohne den Effekt neu auszulösen.
  const tRef = useRef(t);
  tRef.current = t;

  const benefits = [
    { icon: InfinityIcon, title: t.pro.benefitUnlimitedTitle, text: t.pro.benefitUnlimitedText },
    { icon: BarChart3, title: t.pro.benefitStatsTitle, text: t.pro.benefitStatsText },
    { icon: ShieldOff, title: t.pro.benefitAdsTitle, text: t.pro.benefitAdsText },
  ];
  const comparison: { label: string; free: string | boolean; pro: string | boolean }[] = [
    { label: t.pro.rowRanked, free: t.pro.rowRankedFree, pro: t.pro.rowRankedPro },
    { label: t.pro.rowRating, free: true, pro: true },
    { label: t.pro.rowStats, free: false, pro: true },
    { label: t.pro.rowPractice, free: false, pro: true },
    { label: t.pro.rowAdFree, free: false, pro: true },
  ];
  const formatDate = (iso: string) => new Intl.DateTimeFormat(lang, { dateStyle: "long" }).format(new Date(iso));

  // Rückkehr vom Stripe-Checkout: Abo sofort abgleichen, statt auf den Webhook zu warten.
  useEffect(() => {
    const status = params.get("checkout");
    const sessionId = params.get("session_id");
    if (!status || !user || synced.current) return;
    synced.current = true;
    if (status === "cancel") {
      toast(tRef.current.pro.checkoutCancelled);
      setParams({}, { replace: true });
      return;
    }
    if (status === "success" && sessionId) {
      setSyncing(true);
      api
        .syncCheckout(sessionId)
        .then((u) => {
          setUser(u);
          if (u.pro) toast.success(tRef.current.pro.welcome);
          else toast(tRef.current.pro.paymentPending);
        })
        .catch((err: Error) => toast.error(errorText(err)))
        .finally(() => {
          setSyncing(false);
          setParams({}, { replace: true });
        });
    }
  }, [params, user, setParams, setUser, errorText]);

  const checkout = useMutation({
    mutationFn: api.checkout,
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (err: Error) => toast.error(errorText(err)),
  });
  const portal = useMutation({
    mutationFn: api.portal,
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (err: Error) => toast.error(errorText(err)),
  });
  const devToggle = useMutation({
    mutationFn: api.devTogglePro,
    onSuccess: (u) => setUser(u),
    onError: (err: Error) => toast.error(errorText(err)),
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
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{t.pro.headline}</h1>
        <p className="text-muted-foreground">{t.pro.subline}</p>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-5">
        <Card className="md:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-baseline gap-1">
              <span className="text-4xl font-bold">{PRO_PRICE_LABEL}</span>
              <span className="text-muted-foreground text-base font-normal">{t.common.perMonth}</span>
            </CardTitle>
            <CardDescription>{t.pro.cancelAnytime}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {benefits.map(({ icon: Icon, title, text }) => (
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
                {t.pro.signInAndGet}
              </Button>
            ) : user.pro ? (
              <>
                <div className="bg-muted/50 rounded-md border p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <Check className="text-success size-4" /> {t.pro.active}
                  </div>
                  {sub?.periodEnd && (
                    <div className="text-muted-foreground mt-1">
                      {fmt(sub.cancelAtPeriodEnd ? t.pro.endsOn : t.pro.renewsOn, { date: formatDate(sub.periodEnd) })}
                    </div>
                  )}
                </div>
                <Button size="lg" variant="outline" disabled={!stripeEnabled || busy} onClick={() => portal.mutate()}>
                  {portal.isPending && <Loader2 className="animate-spin" />}
                  {t.pro.manage}
                </Button>
              </>
            ) : (
              <Button size="lg" disabled={!stripeEnabled || busy} onClick={() => checkout.mutate()}>
                {busy ? <Loader2 className="animate-spin" /> : <Crown />}
                {syncing ? t.pro.verifying : fmt(t.pro.get, { price: PRO_PRICE_LABEL })}
              </Button>
            )}
            {config.data && !stripeEnabled && (
              <p className="text-muted-foreground text-center text-xs">
                {fmt(t.pro.notConfigured, { key: "STRIPE_SECRET_KEY" })}
              </p>
            )}
            {user && config.data?.devLogin && (
              <Button variant="ghost" size="sm" disabled={devToggle.isPending} onClick={() => devToggle.mutate()}>
                {user.pro ? t.pro.devToggleOff : t.pro.devToggleOn}
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
              {comparison.map((row) => (
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
