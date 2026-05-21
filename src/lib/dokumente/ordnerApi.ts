// API-Wrapper für Dokument-Ordner.
import { api } from "@/lib/api/client";
import type { DokumentOrdner, DokumentOrdnerListe } from "@/lib/api/types";

export const ordnerApi = {
  list: () => api.get<DokumentOrdnerListe>("/dokumente/ordner"),
  create: (input: { name: string; parentId?: string | null }) =>
    api.post<DokumentOrdner>("/dokumente/ordner", input),
  patch: (id: string, patch: { name?: string; parentId?: string | null }) =>
    api.patch<DokumentOrdner>(`/dokumente/ordner/${id}`, patch),
  remove: (id: string, mode: "move-to-parent" | "cascade") =>
    api.delete<{ geloescht: boolean; verschoben: number; mitgeloescht: number }>(
      `/dokumente/ordner/${id}?mode=${mode}`,
    ),
  bulkMove: (ids: string[], ordnerId: string | null) =>
    api.post<{ verschoben: number }>("/dokumente/bulk-move", { ids, ordnerId }),
};

/** Pfad-Segmente vom Root bis zum gegebenen Ordner. */
export function ordnerPfad(
  alle: DokumentOrdner[],
  id: string | null,
): DokumentOrdner[] {
  if (!id) return [];
  const map = new Map(alle.map((o) => [o.id, o]));
  const out: DokumentOrdner[] = [];
  let cur: DokumentOrdner | undefined = map.get(id);
  const guard = new Set<string>();
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id);
    out.unshift(cur);
    cur = cur.parentId ? map.get(cur.parentId) : undefined;
  }
  return out;
}

/** Direkte Kinder eines Ordners (parent = null → Top-Level). */
export function ordnerKinder(
  alle: DokumentOrdner[],
  parentId: string | null,
): DokumentOrdner[] {
  return alle
    .filter((o) => (o.parentId ?? null) === parentId)
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}