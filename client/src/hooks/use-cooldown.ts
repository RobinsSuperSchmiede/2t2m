import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

/** Verbleibende Zeit (ms) bis zum nächsten kostenlosen Duell; 0 = jetzt spielbar oder Pro. */
export function useCooldown(): number {
  const { user } = useAuth();
  const target = user && !user.pro && user.nextGameAt ? Date.parse(user.nextGameAt) : 0;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    if (target <= Date.now()) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= target) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [target]);

  return Math.max(0, target - now);
}

export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mmss = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}
