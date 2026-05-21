import { useMemo, useState } from "react";
import { Folder, FolderPlus, ChevronRight, Home } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDokumentOrdner } from "@/hooks/useDokumentOrdner";
import { ordnerKinder, ordnerPfad } from "@/lib/dokumente/ordnerApi";
import { NeuerOrdnerDialog } from "./NeuerOrdnerDialog";
import { cn } from "@/lib/utils";
import type { DokumentOrdner } from "@/lib/api/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Aktueller Ordner (für „Verschieben nach…" als ausgeschlossener Selbst-Pfad). */
  excludeId?: string | null;
  /** Auswahl bestätigen. `null` = Wurzel (Alle Dokumente). */
  onSelect: (ordnerId: string | null) => void;
  title?: string;
  showRoot?: boolean;
}

export function OrdnerPickerSheet({
  open, onOpenChange, excludeId, onSelect,
  title = "Ordner wählen", showRoot = true,
}: Props) {
  const { data } = useDokumentOrdner();
  const ordner = data?.ordner ?? [];
  const [aktuell, setAktuell] = useState<string | null>(null);
  const [neuOffen, setNeuOffen] = useState(false);
  const [filter, setFilter] = useState("");

  const kinder = useMemo(() => ordnerKinder(ordner, aktuell), [ordner, aktuell]);
  const pfad = useMemo(() => ordnerPfad(ordner, aktuell), [ordner, aktuell]);

  const sichtbar = filter.trim()
    ? ordner.filter((o) => o.name.toLowerCase().includes(filter.trim().toLowerCase()))
    : kinder;

  function istAusgeschlossen(o: DokumentOrdner): boolean {
    if (!excludeId) return false;
    if (o.id === excludeId) return true;
    // Auch alle Nachfahren ausschließen (Zyklus-Schutz).
    let cur: string | null = o.parentId;
    while (cur) {
      if (cur === excludeId) return true;
      cur = ordner.find((x) => x.id === cur)?.parentId ?? null;
    }
    return false;
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] sm:max-w-lg sm:mx-auto sm:rounded-t-2xl flex flex-col">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 overflow-x-auto py-2 text-sm">
          <button
            type="button"
            onClick={() => setAktuell(null)}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-1 hover:bg-muted",
              aktuell === null && "font-medium",
            )}
          >
            <Home className="h-3.5 w-3.5" /> Alle
          </button>
          {pfad.map((p) => (
            <span key={p.id} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              <button
                type="button"
                onClick={() => setAktuell(p.id)}
                className="rounded-md px-2 py-1 hover:bg-muted"
              >
                {p.name}
              </button>
            </span>
          ))}
        </div>

        <Input
          placeholder="Ordner suchen…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="mb-2"
        />

        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          {showRoot && !filter.trim() && aktuell === null && (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left hover:bg-muted/40"
            >
              <Home className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Alle Dokumente</p>
                <p className="text-xs text-muted-foreground">Kein Ordner</p>
              </div>
            </button>
          )}
          <div className="mt-2 space-y-1.5">
            {sichtbar.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {filter ? "Keine Treffer" : "Noch keine Unterordner"}
              </p>
            )}
            {sichtbar.map((o) => {
              const disabled = istAusgeschlossen(o);
              return (
                <div
                  key={o.id}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border border-border bg-card p-2",
                    disabled && "opacity-50",
                  )}
                >
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onSelect(o.id)}
                    className="flex flex-1 items-center gap-3 rounded-lg p-1.5 text-left hover:bg-muted/40 disabled:cursor-not-allowed"
                  >
                    <Folder className="h-5 w-5 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{o.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {o.anzahlDokumente} Dok · {o.anzahlKinder} Unterordner
                      </p>
                    </div>
                  </button>
                  {o.anzahlKinder > 0 && !filter && (
                    <Button variant="ghost" size="sm" onClick={() => setAktuell(o.id)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-2">
          <Button
            variant="outline"
            className="w-full rounded-xl"
            onClick={() => setNeuOffen(true)}
          >
            <FolderPlus className="mr-2 h-4 w-4" />
            Neuer Ordner hier
          </Button>
        </div>

        <NeuerOrdnerDialog
          open={neuOffen}
          onOpenChange={setNeuOffen}
          parentId={aktuell}
          parentName={pfad[pfad.length - 1]?.name}
          onCreated={(o) => onSelect(o.id)}
        />
      </SheetContent>
    </Sheet>
  );
}