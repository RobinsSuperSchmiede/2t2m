import { useState } from "react";
import { DEFAULT_SETTINGS, isGameSettings, type GameSettings } from "@2t2m/shared";

const STORAGE_KEY = "game-settings";

function storedSettings(): GameSettings {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return isGameSettings(value) ? value : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Zuletzt gewählte Spieldauer und Fragetyp – bleiben nach dem Neuladen erhalten. */
export function useGameSettings() {
  const [settings, setSettingsState] = useState<GameSettings>(storedSettings);
  const setSettings = (patch: Partial<GameSettings>) => {
    const next = { ...settings, ...patch };
    setSettingsState(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ohne Speicher gilt die Auswahl nur bis zum Neuladen.
    }
  };
  return [settings, setSettings] as const;
}
