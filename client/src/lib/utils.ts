import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Eigene Theme-Farben bekannt machen, sonst hält tailwind-merge z. B. "text-danger"
// für eine Schriftgröße und entfernt es neben "text-6xl".
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: ["success", "danger"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
