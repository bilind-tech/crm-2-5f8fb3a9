import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useCreateOrdner } from "@/hooks/useDokumentOrdner";
import type { DokumentOrdner } from "@/lib/api/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  parentId: string | null;
  parentName?: string;
  onCreated?: (o: DokumentOrdner) => void;
}

export function NeuerOrdnerDialog({ open, onOpenChange, parentId, parentName, onCreated }: Props) {
  const [name, setName] = useState("");
  const create = useCreateOrdner();

  function submit() {
    if (!name.trim()) return;
    create.mutate(
      { name: name.trim(), parentId },
      {
        onSuccess: (o) => {
          onCreated?.(o);
          setName("");
          onOpenChange(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setName(""); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Neuer Ordner</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="ordner-name">Name</Label>
            <Input
              id="ordner-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="z. B. Steuer 2026"
              maxLength={80}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Wird angelegt unter: <strong>{parentName ?? "Alle Dokumente"}</strong>
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={submit} disabled={!name.trim() || create.isPending}>
            {create.isPending ? "Anlegen…" : "Anlegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}