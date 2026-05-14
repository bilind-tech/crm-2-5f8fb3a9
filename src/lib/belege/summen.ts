// Beleg-Summen — neutrale Helfer für Position/Rechnung-Berechnungen.
// Kein Mock-Bezug, reine Mathematik.
import type { Position } from "@/lib/api/types";

export function summePosition(p: Position): number {
  const rabatt = p.rabatt ?? 0;
  const netto = p.modus === "pauschal"
    ? (p.pauschalpreisNetto ?? 0)
    : (p.menge ?? 0) * (p.einzelpreisNetto ?? 0);
  return netto * (1 - rabatt / 100);
}

export function summenRechnung(
  positionen: Position[],
  rabattGesamt: number,
): { netto: number; steuer: number; brutto: number } {
  const gesamtRabatt = rabattGesamt ?? 0;
  const netto = positionen.reduce((s, p) => s + summePosition(p), 0) * (1 - gesamtRabatt / 100);
  let steuer = 0;
  for (const p of positionen) {
    steuer += summePosition(p) * ((p.steuersatz ?? 0) / 100);
  }
  steuer *= 1 - gesamtRabatt / 100;
  const brutto = netto + steuer;
  return { netto, steuer, brutto };
}
