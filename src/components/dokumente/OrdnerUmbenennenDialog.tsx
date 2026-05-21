import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useUpdateOrdner } from "@/hooks/useDokumentOrdner";
import type { DokumentOrdner } from "@/lib/api/types";

interface Props {
  ordner: DokumentOrdner | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function OrdnerUmbenennenDialog({ ordner, open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const update = useUpdateOrdner();
  useEffect(() => { if (open && ordner) setName(ordner.name); }, [open, ordner]);
  if (!ordner) return null;

  function submit() {
    if (!ordner) return;
    const trimmed = name.trim();
    if (!trimmed || trimmed === ordner.name) { onOpenChange(false); return; }
    update.mutate({ id: ordner.id, name: trimmed }, { onSuccess: () => onOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ordner umbenennen</DialogTitle>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="rename-input">Neuer Name</Label>
          <Input
            id="rename-input"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            maxLength={80}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={submit} disabled={update.isPending}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}