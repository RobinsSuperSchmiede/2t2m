import type { TierId } from "@2t2m/shared";

/** Farben pro Rangstufe – als Tailwind-Klassen, damit sie im Build landen. */
export const TIER_STYLES: Record<TierId, { text: string; bg: string; ring: string; gradient: string }> = {
  bronze: {
    text: "text-orange-300",
    bg: "bg-orange-400/10",
    ring: "ring-orange-400/30",
    gradient: "from-orange-700 to-orange-400",
  },
  silver: {
    text: "text-zinc-200",
    bg: "bg-zinc-300/10",
    ring: "ring-zinc-300/30",
    gradient: "from-zinc-500 to-zinc-200",
  },
  gold: {
    text: "text-amber-300",
    bg: "bg-amber-400/10",
    ring: "ring-amber-400/30",
    gradient: "from-amber-600 to-yellow-300",
  },
  platinum: {
    text: "text-teal-200",
    bg: "bg-teal-300/10",
    ring: "ring-teal-300/30",
    gradient: "from-teal-600 to-cyan-200",
  },
  diamond: {
    text: "text-sky-300",
    bg: "bg-sky-400/10",
    ring: "ring-sky-400/30",
    gradient: "from-sky-600 to-indigo-300",
  },
  master: {
    text: "text-fuchsia-300",
    bg: "bg-fuchsia-400/10",
    ring: "ring-fuchsia-400/30",
    gradient: "from-fuchsia-700 to-pink-300",
  },
  grandmaster: {
    text: "text-rose-300",
    bg: "bg-rose-400/10",
    ring: "ring-rose-400/30",
    gradient: "from-rose-700 via-red-500 to-amber-300",
  },
};
