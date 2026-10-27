import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import type { BackdropItem } from "@2t2m/shared";
import { api } from "@/lib/api";

const COLUMNS = 7;
const OPACITY = 0.12;

interface Placement {
  left: number;
  top: number;
  size: number;
  drift: [number, number];
  rotate: number;
  duration: number;
  delay: number;
}

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** Verteilt die Bilder grob auf ein Raster, damit sie nicht auf einem Haufen liegen. */
function place(count: number): Placement[] {
  const rows = Math.ceil(count / COLUMNS);
  return Array.from({ length: count }, (_, i) => ({
    left: ((i % COLUMNS) + rand(0.1, 0.7)) * (100 / COLUMNS),
    top: (Math.floor(i / COLUMNS) + rand(0.1, 0.7)) * (100 / rows),
    size: rand(72, 136),
    drift: [rand(-90, 90), rand(-70, 70)],
    rotate: rand(-14, 14),
    duration: rand(22, 38),
    delay: rand(0, 1.5),
  }));
}

function BackdropImage({ item }: { item: BackdropItem }) {
  if (item.type === "svg") {
    return (
      <div
        className="flag-svg aspect-[3/2] w-full overflow-hidden rounded-sm"
        // Markup stammt vom eigenen Server (country-flag-icons), nicht von Nutzern.
        dangerouslySetInnerHTML={{ __html: item.markup }}
      />
    );
  }
  return (
    <svg viewBox={item.viewBox} className="aspect-square w-full">
      <path
        d={item.d}
        fill="var(--foreground)"
        fillOpacity={0.15}
        stroke="var(--foreground)"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Langsam umherschwebende Flaggen und Länderumrisse hinter der Spielseite. */
export function Backdrop() {
  const reduceMotion = useReducedMotion();
  const backdrop = useQuery({ queryKey: ["backdrop"], queryFn: api.backdrop, staleTime: Infinity });
  const items = backdrop.data ?? [];
  const placements = useMemo(() => place(items.length), [items.length]);

  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.8 }}
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      {items.map((item, i) => {
        const p = placements[i]!;
        const [dx, dy] = p.drift;
        return (
          <motion.div
            key={i}
            className="absolute"
            style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size }}
            initial={{ opacity: 0, scale: 0.8, rotate: p.rotate }}
            animate={
              reduceMotion
                ? { opacity: OPACITY, scale: 1 }
                : {
                    opacity: OPACITY,
                    scale: 1,
                    x: [0, dx, -dx * 0.6, 0],
                    y: [0, -dy, dy * 0.8, 0],
                    rotate: [p.rotate, -p.rotate, p.rotate * 0.5, p.rotate],
                  }
            }
            transition={{
              opacity: { duration: 1.2, delay: p.delay },
              scale: { duration: 1.2, delay: p.delay },
              default: { duration: p.duration, repeat: Infinity, ease: "easeInOut" },
            }}
          >
            {/* Flaggen nur dezent farbig, damit sie nicht vom Inhalt ablenken */}
            <div className={item.type === "svg" ? "saturate-[0.6]" : undefined}>
              <BackdropImage item={item} />
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
