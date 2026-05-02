// Frist-Berechnung — gespiegelt von src/lib/dokument/frist.ts (Backend-Variante).
import type { Dokument } from "./types.js";

export type FristStatus = "kein" | "ueberfaellig" | "heute" | "bald" | "offen" | "erledigt";

const MS_TAG = 24 * 60 * 60 * 1000;

export function fristStatus(d: Pick<Dokument, "faelligAm" | "erledigtAm">, today = new Date()): FristStatus {
  if (d.erledigtAm) return "erledigt";
  if (!d.faelligAm) return "kein";
  const due = new Date(`${d.faelligAm}T00:00:00Z`);
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const diff = Math.round((due.getTime() - todayUtc.getTime()) / MS_TAG);
  if (diff < 0) return "ueberfaellig";
  if (diff === 0) return "heute";
  if (diff <= 7) return "bald";
  return "offen";
}

export function isNotifyStatus(s: FristStatus): s is "ueberfaellig" | "heute" | "bald" {
  return s === "ueberfaellig" || s === "heute" || s === "bald";
}
