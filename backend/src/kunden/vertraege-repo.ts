// Repository: Kunden-Verträge (CRUD + Soft-Delete).
// Bewusst schlank — keine Positionen, keine Hierarchie.
import crypto from "node:crypto";
import { getDatabase } from "../db/index.js";

export interface ApiVertrag {
  id: string;
  kundeId: string;
  bezeichnung: string;
  startDatum: string;
  endDatum?: string;
  notiz?: string;
  erstelltAm: string;
  geaendertAm: string;
}

interface DbVertrag {
  id: string;
  kunde_id: string;
  bezeichnung: string;
  start_datum: string;
  end_datum: string | null;
  notiz: string | null;
  erstellt_am: string;
  geaendert_am: string;
}

const COLS = `id, kunde_id, bezeichnung, start_datum, end_datum, notiz, erstellt_am, geaendert_am`;

function rowToApi(r: DbVertrag): ApiVertrag {
  return {
    id: r.id,
    kundeId: r.kunde_id,
    bezeichnung: r.bezeichnung,
    startDatum: r.start_datum,
    endDatum: r.end_datum ?? undefined,
    notiz: r.notiz ?? undefined,
    erstelltAm: r.erstellt_am,
    geaendertAm: r.geaendert_am,
  };
}

export function listVertraege(kundeId: string): ApiVertrag[] {
  const rows = getDatabase()
    .prepare(
      `SELECT ${COLS} FROM kunde_vertrag
        WHERE kunde_id = ? AND geloescht_am IS NULL
        ORDER BY start_datum DESC, erstellt_am DESC`,
    )
    .all(kundeId) as DbVertrag[];
  return rows.map(rowToApi);
}

export function getVertrag(id: string): ApiVertrag | null {
  const row = getDatabase()
    .prepare(`SELECT ${COLS} FROM kunde_vertrag WHERE id = ? AND geloescht_am IS NULL`)
    .get(id) as DbVertrag | undefined;
  return row ? rowToApi(row) : null;
}

export interface VertragWrite {
  kundeId: string;
  bezeichnung?: string;
  startDatum: string;
  endDatum?: string | null;
  notiz?: string | null;
}

export function createVertrag(data: VertragWrite): ApiVertrag {
  const id = crypto.randomUUID();
  getDatabase()
    .prepare(
      `INSERT INTO kunde_vertrag (id, kunde_id, bezeichnung, start_datum, end_datum, notiz)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      data.kundeId,
      (data.bezeichnung ?? "").trim(),
      data.startDatum,
      data.endDatum ?? null,
      data.notiz ?? null,
    );
  return getVertrag(id)!;
}

const UPDATABLE: Record<string, string> = {
  bezeichnung: "bezeichnung",
  startDatum: "start_datum",
  endDatum: "end_datum",
  notiz: "notiz",
};

export function updateVertrag(id: string, patch: Record<string, unknown>): ApiVertrag | null {
  const db = getDatabase();
  const cur = db
    .prepare(`SELECT id FROM kunde_vertrag WHERE id = ? AND geloescht_am IS NULL`)
    .get(id) as { id: string } | undefined;
  if (!cur) return null;
  const sets: string[] = [];
  const params: Record<string, unknown> = { id };
  for (const [k, v] of Object.entries(patch)) {
    const col = UPDATABLE[k];
    if (!col) continue;
    sets.push(`${col} = @${col}`);
    params[col] = v === "" ? null : v;
  }
  if (sets.length === 0) return getVertrag(id);
  sets.push(`geaendert_am = datetime('now')`);
  db.prepare(`UPDATE kunde_vertrag SET ${sets.join(", ")} WHERE id = @id`).run(params);
  return getVertrag(id);
}

export function softDeleteVertrag(id: string): boolean {
  const r = getDatabase()
    .prepare(
      `UPDATE kunde_vertrag
          SET geloescht_am = datetime('now'),
              geaendert_am = datetime('now')
        WHERE id = ? AND geloescht_am IS NULL`,
    )
    .run(id);
  return r.changes > 0;
}