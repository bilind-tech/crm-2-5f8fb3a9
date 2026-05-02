// Atomare Vergabe von Belegnummern und Stammdaten-Nummern.
// SQLite "INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING" ist eine einzige
// Anweisung und damit innerhalb der WAL-Schreibtransaktion atomar.
// Mehrere parallele Aufrufe können nicht dieselbe Nummer ziehen — busy_timeout
// + WAL bringen sie in Reihe.

import { getDatabase } from "../db/index.js";

/** Liefert die nächste laufende Nummer für (kunde, periodeMMYY). */
export function nextBelegNummer(kundeId: string, periodeMMYY: string): number {
  const row = getDatabase()
    .prepare(
      `INSERT INTO belegnummer_zaehler (kunde_id, periode, naechster_start)
       VALUES (?, ?, 2)
       ON CONFLICT(kunde_id, periode) DO UPDATE SET naechster_start = naechster_start + 1
       RETURNING naechster_start`,
    )
    .get(kundeId, periodeMMYY) as { naechster_start: number };
  // Bei INSERT (kein Conflict) liefert RETURNING den eingefügten Wert (=2).
  // Die tatsächlich verwendete Nummer ist also (rückwärts gerechnet) start - 1.
  // Wenn UPDATE: zurückgelieferter Wert ist der NEUE start; die vergebene
  // Nummer ist start - 1.
  return row.naechster_start - 1;
}

/** Vorschau ohne Vergabe — fürs Frontend (`/kunden/:id/zaehler`). */
export function peekBelegNummer(kundeId: string, periodeMMYY: string): number {
  const row = getDatabase()
    .prepare(
      `SELECT naechster_start FROM belegnummer_zaehler WHERE kunde_id=? AND periode=?`,
    )
    .get(kundeId, periodeMMYY) as { naechster_start: number } | undefined;
  return row ? row.naechster_start : 1;
}

/** Liefert die nächste Kundennummer im gegebenen Jahr (1, 2, 3, …). */
export function nextKundeNummer(jahr: number): number {
  const row = getDatabase()
    .prepare(
      `INSERT INTO kunde_nummer_zaehler (jahr, naechster)
       VALUES (?, 2)
       ON CONFLICT(jahr) DO UPDATE SET naechster = naechster + 1
       RETURNING naechster`,
    )
    .get(jahr) as { naechster: number };
  return row.naechster - 1;
}

/** Liefert die nächste Objektnummer im gegebenen Jahr. */
export function nextObjektNummer(jahr: number): number {
  const row = getDatabase()
    .prepare(
      `INSERT INTO objekt_nummer_zaehler (jahr, naechster)
       VALUES (?, 2)
       ON CONFLICT(jahr) DO UPDATE SET naechster = naechster + 1
       RETURNING naechster`,
    )
    .get(jahr) as { naechster: number };
  return row.naechster - 1;
}

/** Format "K-YYYY-NNN". */
export function formatKundeNummer(jahr: number, n: number): string {
  return `K-${jahr}-${String(n).padStart(3, "0")}`;
}
export function formatObjektNummer(jahr: number, n: number): string {
  return `O-${jahr}-${String(n).padStart(3, "0")}`;
}

/** "MMYY" für ein Datum (default: jetzt). */
export function periodeMMYY(date: Date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = String(date.getFullYear()).slice(-2);
  return `${m}${y}`;
}
