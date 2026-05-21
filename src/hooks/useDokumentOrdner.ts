import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ordnerApi } from "@/lib/dokumente/ordnerApi";
import type { DokumentOrdnerListe } from "@/lib/api/types";

export const ordnerQk = ["dokumente", "ordner"] as const;

export function useDokumentOrdner() {
  return useQuery<DokumentOrdnerListe>({
    queryKey: ordnerQk,
    queryFn: ordnerApi.list,
  });
}

export function useCreateOrdner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ordnerApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ordnerQk }),
    onError: (e) => toast.error(humanFehler(e)),
  });
}

export function useUpdateOrdner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; name?: string; parentId?: string | null }) =>
      ordnerApi.patch(v.id, { name: v.name, parentId: v.parentId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ordnerQk });
      qc.invalidateQueries({ queryKey: ["dokumente"] });
    },
    onError: (e) => toast.error(humanFehler(e)),
  });
}

export function useDeleteOrdner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; mode: "move-to-parent" | "cascade" }) =>
      ordnerApi.remove(v.id, v.mode),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ordnerQk });
      qc.invalidateQueries({ queryKey: ["dokumente"] });
    },
    onError: (e) => toast.error(humanFehler(e)),
  });
}

export function useBulkMoveDokumente() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { ids: string[]; ordnerId: string | null }) =>
      ordnerApi.bulkMove(v.ids, v.ordnerId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ordnerQk });
      qc.invalidateQueries({ queryKey: ["dokumente"] });
    },
    onError: (e) => toast.error(humanFehler(e)),
  });
}

function humanFehler(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/name-exists/.test(msg)) return "Ein Ordner mit diesem Namen existiert hier bereits.";
  if (/zyklus/.test(msg)) return "Ein Ordner kann nicht in sich selbst verschoben werden.";
  if (/name-leer/.test(msg)) return "Bitte einen Namen eingeben.";
  if (/parent-missing/.test(msg)) return "Zielordner nicht gefunden.";
  return msg || "Aktion fehlgeschlagen";
}