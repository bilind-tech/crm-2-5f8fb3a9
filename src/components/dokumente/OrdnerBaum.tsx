import { useState } from "react";
import { ChevronRight, Folder, FolderOpen, Home, MoreVertical, FolderPlus, Pencil, Trash2, FolderInput } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ordnerKinder } from "@/lib/dokumente/ordnerApi";
import type { DokumentOrdner, DokumentOrdnerListe } from "@/lib/api/types";

interface Props {
  daten: DokumentOrdnerListe | undefined;
  aktivId: string | null;
  onSelect: (id: string | null) => void;
  onNeuerOrdner: (parentId: string | null) => void;
  onUmbenennen: (o: DokumentOrdner) => void;
  onVerschieben: (o: DokumentOrdner) => void;
  onLoeschen: (o: DokumentOrdner) => void;
}

export function OrdnerBaum(p: Props) {
  const ordner = p.daten?.ordner ?? [];
  const top = ordnerKinder(ordner, null);
  const rootAnzahl = (p.daten?.root.anzahlDokumente ?? 0);
  return (
    <div className="space-y-0.5">
      <Zeile
        label="Alle Dokumente"
        icon={<Home className="h-4 w-4" />}
        zahl={rootAnzahl}
        aktiv={p.aktivId === null}
        onClick={() => p.onSelect(null)}
        action={
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); p.onNeuerOrdner(null); }}
            title="Neuer Ordner"
          >
            <FolderPlus className="h-3.5 w-3.5" />
          </Button>
        }
      />
      <div className="pl-1">
        {top.map((o) => (
          <BaumKnoten
            key={o.id}
            ordner={o}
            alle={ordner}
            tiefe={0}
            aktivId={p.aktivId}
            onSelect={p.onSelect}
            onNeuerOrdner={p.onNeuerOrdner}
            onUmbenennen={p.onUmbenennen}
            onVerschieben={p.onVerschieben}
            onLoeschen={p.onLoeschen}
          />
        ))}
      </div>
    </div>
  );
}

function BaumKnoten({
  ordner, alle, tiefe, aktivId, onSelect, onNeuerOrdner, onUmbenennen, onVerschieben, onLoeschen,
}: {
  ordner: DokumentOrdner;
  alle: DokumentOrdner[];
  tiefe: number;
  aktivId: string | null;
  onSelect: (id: string | null) => void;
  onNeuerOrdner: (parentId: string | null) => void;
  onUmbenennen: (o: DokumentOrdner) => void;
  onVerschieben: (o: DokumentOrdner) => void;
  onLoeschen: (o: DokumentOrdner) => void;
}) {
  const [offen, setOffen] = useState(true);
  const kinder = ordnerKinder(alle, ordner.id);
  const aktiv = aktivId === ordner.id;
  return (
    <div>
      <Zeile
        label={ordner.name}
        icon={aktiv ? <FolderOpen className="h-4 w-4 text-primary" /> : <Folder className="h-4 w-4" />}
        zahl={ordner.anzahlDokumente}
        aktiv={aktiv}
        onClick={() => onSelect(ordner.id)}
        indent={tiefe}
        chevron={
          kinder.length > 0 ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOffen((v) => !v); }}
              className="rounded p-0.5 hover:bg-muted"
            >
              <ChevronRight className={cn("h-3.5 w-3.5 transition", offen && "rotate-90")} />
            </button>
          ) : <span className="inline-block w-4" />
        }
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => e.stopPropagation()}>
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onNeuerOrdner(ordner.id)}>
                <FolderPlus className="mr-2 h-4 w-4" /> Unterordner anlegen
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onUmbenennen(ordner)}>
                <Pencil className="mr-2 h-4 w-4" /> Umbenennen
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onVerschieben(ordner)}>
                <FolderInput className="mr-2 h-4 w-4" /> Verschieben nach…
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive" onClick={() => onLoeschen(ordner)}>
                <Trash2 className="mr-2 h-4 w-4" /> Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      {offen && kinder.length > 0 && (
        <div>
          {kinder.map((k) => (
            <BaumKnoten
              key={k.id}
              ordner={k}
              alle={alle}
              tiefe={tiefe + 1}
              aktivId={aktivId}
              onSelect={onSelect}
              onNeuerOrdner={onNeuerOrdner}
              onUmbenennen={onUmbenennen}
              onVerschieben={onVerschieben}
              onLoeschen={onLoeschen}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Zeile({ label, icon, zahl, aktiv, onClick, action, chevron, indent = 0 }: {
  label: string;
  icon: React.ReactNode;
  zahl?: number;
  aktiv?: boolean;
  onClick: () => void;
  action?: React.ReactNode;
  chevron?: React.ReactNode;
  indent?: number;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex cursor-pointer items-center gap-1.5 rounded-lg pr-1 text-sm transition",
        aktiv ? "bg-primary/10 text-primary" : "hover:bg-muted/50",
      )}
      style={{ paddingLeft: `${4 + indent * 12}px` }}
    >
      {chevron}
      <span className="flex-shrink-0">{icon}</span>
      <span className="flex-1 truncate py-1.5">{label}</span>
      {zahl !== undefined && zahl > 0 && (
        <span className="text-xs text-muted-foreground">{zahl}</span>
      )}
      <span className="opacity-0 transition group-hover:opacity-100">{action}</span>
    </div>
  );
}