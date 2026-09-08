/**
 * Player-facing settings (volume, difficulty) and the small "beat your last
 * result" record, persisted in localStorage. Deliberately tiny: parsing is
 * defensive (anything malformed falls back to defaults), storage access is
 * wrapped so private-mode/SSR/quota failures never reach the UI, and the
 * pure parse/merge helpers are what the unit tests cover.
 */
import type { Difficulty } from "@/game/types";

export interface GameSettings {
  /** Master volume in [0, 1]. */
  volume: number;
  difficulty: Difficulty;
}

export const DEFAULT_SETTINGS: GameSettings = { volume: 0.7, difficulty: "normal" };
export const DIFFICULTIES: readonly Difficulty[] = ["easy", "normal", "hard", "insane"];

const SETTINGS_KEY = "tenis-da-vida:settings";
const RECORDS_KEY = "tenis-da-vida:records";

export interface MatchRecords {
  /** Longest rally (hits) ever reached in a match. */
  longestRally: number;
  /** Highest share of Leo's swings that were PERFECT/GOOD/LATE rather than misses, in [0, 1]. */
  bestAccuracy: number;
  /** Matches Leo has won. */
  wins: number;
}

export const EMPTY_RECORDS: MatchRecords = { longestRally: 0, bestAccuracy: 0, wins: 0 };

export function parseSettings(raw: unknown): GameSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SETTINGS };
  const obj = raw as Record<string, unknown>;
  const volume = typeof obj.volume === "number" && Number.isFinite(obj.volume) ? Math.max(0, Math.min(1, obj.volume)) : DEFAULT_SETTINGS.volume;
  const difficulty = DIFFICULTIES.includes(obj.difficulty as Difficulty) ? (obj.difficulty as Difficulty) : DEFAULT_SETTINGS.difficulty;
  return { volume, difficulty };
}

export function parseRecords(raw: unknown): MatchRecords {
  if (!raw || typeof raw !== "object") return { ...EMPTY_RECORDS };
  const obj = raw as Record<string, unknown>;
  const num = (v: unknown, max = Number.POSITIVE_INFINITY) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.min(v, max) : 0);
  return { longestRally: Math.floor(num(obj.longestRally)), bestAccuracy: num(obj.bestAccuracy, 1), wins: Math.floor(num(obj.wins)) };
}

/** Folds one finished match into the stored records — every field is a "best so far" or a running total, never overwritten downward. */
export function mergeRecords(records: MatchRecords, result: { longestRally: number; accuracy: number; leoWon: boolean }): MatchRecords {
  return {
    longestRally: Math.max(records.longestRally, result.longestRally),
    bestAccuracy: Math.max(records.bestAccuracy, result.accuracy),
    wins: records.wins + (result.leoWon ? 1 : 0),
  };
}

function readJson(key: string): unknown {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable (private mode, quota, disabled) — settings just don't persist this session.
  }
}

export function loadSettings(): GameSettings {
  return parseSettings(readJson(SETTINGS_KEY));
}

export function saveSettings(settings: GameSettings): void {
  writeJson(SETTINGS_KEY, settings);
}

export function loadRecords(): MatchRecords {
  return parseRecords(readJson(RECORDS_KEY));
}

export function saveRecords(records: MatchRecords): void {
  writeJson(RECORDS_KEY, records);
}
