import { useEffect, useRef } from "react";
import { Link } from "react-router";
import { Check } from "lucide-react";
import { PRO_PRICE_LABEL } from "@2t2m/shared";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

// Optional: Google AdSense. Ohne Konfiguration wird eine eigene Anzeige für Pro gezeigt.
const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;
const ADSENSE_SLOT_RAIL = import.meta.env.VITE_ADSENSE_SLOT_RAIL as string | undefined;
const ADSENSE_SLOT_INLINE = import.meta.env.VITE_ADSENSE_SLOT_INLINE as string | undefined;

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

let adsenseLoaded = false;
function loadAdsense() {
  if (adsenseLoaded || !ADSENSE_CLIENT) return;
  adsenseLoaded = true;
  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
  document.head.appendChild(script);
}

/** Pro-Spieler sehen keine Werbung. */
export function useShowAds() {
  const { user, loading } = useAuth();
  return !loading && !user?.pro;
}

function AdSense({ slot, className }: { slot: string; className?: string }) {
  const pushed = useRef(false);
  useEffect(() => {
    loadAdsense();
    if (pushed.current) return;
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // Werbeblocker o. Ä. – Platz bleibt einfach leer.
    }
  }, []);
  return (
    <ins
      className={cn("adsbygoogle block", className)}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="false"
    />
  );
}

function AdLabel() {
  return <span className="text-muted-foreground text-[10px] tracking-widest uppercase">Anzeige</span>;
}

const BENEFITS = ["Unbegrenzt spielen", "Detaillierte Statistiken", "Keine Werbung"];

function HouseAd({ variant }: { variant: "rail" | "inline" }) {
  return (
    <Link
      to="/pro"
      className={cn(
        "bg-card hover:bg-accent/50 block rounded-lg border p-4 transition-colors",
        variant === "rail" ? "space-y-4" : "flex flex-wrap items-center justify-between gap-3",
      )}
    >
      <div className="space-y-1">
        <div className="text-sm font-semibold">2T2M Pro</div>
        <div className="text-muted-foreground text-xs">{PRO_PRICE_LABEL} / Monat</div>
      </div>
      <ul className={cn("text-muted-foreground space-y-1.5 text-xs", variant === "inline" && "hidden sm:block")}>
        {BENEFITS.map((b) => (
          <li key={b} className="flex items-center gap-1.5">
            <Check className="text-foreground size-3" /> {b}
          </li>
        ))}
      </ul>
      <span className="bg-primary text-primary-foreground inline-flex h-8 items-center rounded-md px-3 text-xs font-medium">
        Upgrade
      </span>
    </Link>
  );
}

/** Schmale Spalte am linken oder rechten Rand – nur auf breiten Bildschirmen, damit das Spiel frei bleibt. */
export function AdRail() {
  return (
    <aside className="hidden w-40 shrink-0 xl:block" aria-label="Anzeige">
      <div className="sticky top-24 space-y-1.5 py-8">
        <AdLabel />
        {ADSENSE_CLIENT && ADSENSE_SLOT_RAIL ? (
          <AdSense slot={ADSENSE_SLOT_RAIL} className="h-[600px] w-40" />
        ) : (
          <HouseAd variant="rail" />
        )}
      </div>
    </aside>
  );
}

/** Kleine Anzeige im Inhalt für schmale Bildschirme, auf denen keine Randspalte Platz hat. */
export function InlineAd({ className }: { className?: string }) {
  const show = useShowAds();
  if (!show) return null;
  return (
    <div className={cn("space-y-1.5 xl:hidden", className)} aria-label="Anzeige">
      <AdLabel />
      {ADSENSE_CLIENT && ADSENSE_SLOT_INLINE ? (
        <AdSense slot={ADSENSE_SLOT_INLINE} className="h-[100px] w-full" />
      ) : (
        <HouseAd variant="inline" />
      )}
    </div>
  );
}
