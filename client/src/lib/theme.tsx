import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "theme";

/** Muss zum Inline-Skript in index.html passen, das das Theme schon vor dem ersten Rendern setzt. */
function storedTheme(): Theme {
  try {
    return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(storedTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ohne Speicher gilt die Auswahl nur bis zum Neuladen.
    }
  }, [theme]);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, toggleTheme: () => setTheme((t) => (t === "dark" ? "light" : "dark")) }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme muss innerhalb von ThemeProvider verwendet werden");
  return ctx;
}
