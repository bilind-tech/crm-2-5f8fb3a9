import { useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useDeleteOrdner } from "@/hooks/useDokumentOrdner";
import type { DokumentOrdner } from "@/lib/api/types";

interface Props {
  ordner: DokumentOrdner | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDeleted?: () => void;
}

export function OrdnerLoeschenDialog({ ordner, open, onOpenChange, onDeleted }: Props) {
  const [mode, setMode] = useState<"move-to-parent" | "cascade">("move-to-parent");
  const del = useDeleteOrdner();
  if (!ordner) return null;
  const hatInhalt = ordner.anzahlDokumente > 0 || ordner.anzahlKinder > 0;

  function bestaetigen() {
    if (!ordner) return;
    del.mutate({ id: ordner.id, mode }, { onSuccess: () => { onDeleted?.(); onOpenChange(false); } });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ordner „{ordner.name}" löschen?</AlertDialogTitle>
          <AlertDialogDescription>
            {hatInhalt
              ? `Dieser Ordner enthält ${ordner.anzahlDokumente} Dokument(e) und ${ordner.anzahlKinder} Unterordner.`
              : "Dieser Ordner ist leer."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {hatInhalt && (
          <div className="space-y-2 text-sm">
            <label className="flex items-start gap-2 rounded-xl border border-border p-3">
              <input
                type="radio"
                checked={mode === "move-to-parent"}
                onChange={() => setMode("move-to-parent")}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Inhalte in den übergeordneten Ordner verschieben</span>
                <br />
                <span className="text-muted-foreground">Empfohlen — nichts geht verloren.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 rounded-xl border border-border p-3">
              <input
                type="radio"
                checked={mode === "cascade"}
                onChange={() => setMode("cascade")}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-destructive">Inhalte mitlöschen</span>
                <br />
                <span className="text-muted-foreground">
                  Alle Dokumente werden in den Papierkorb verschoben (Soft-Delete).
                </span>
              </span>
            </label>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <AlertDialogAction onClick={bestaetigen} disabled={del.isPending}>
            {del.isPending ? "Lösche…" : "Löschen"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}