import { useNavigate } from "@tanstack/react-router";
import { Building2, FileText, FolderClosed, Receipt, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const ITEMS = [
  {
    label: "Kunde",
    route: "/kunden/neu",
    icon: Users,
    desc: "Neuen Kunden anlegen",
    tint: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  {
    label: "Objekt",
    route: "/objekte/neu",
    icon: Building2,
    desc: "Neues Objekt anlegen",
    tint: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    label: "Angebot",
    route: "/angebote/neu",
    icon: FileText,
    desc: "Neues Angebot erstellen",
    tint: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    label: "Rechnung",
    route: "/rechnungen/neu",
    icon: Receipt,
    desc: "Neue Rechnung erstellen",
    tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    label: "Dokument",
    route: "/dokumente",
    icon: FolderClosed,
    desc: "Datei hochladen",
    tint: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  },
] as const;

export function QuickCreate({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="quick-create-dialog max-w-[640px] overflow-hidden rounded-2xl border-border/60 bg-background p-0 shadow-2xl">
        <div className="px-7 pt-7">
          <DialogHeader className="text-left">
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Schnell anlegen
            </DialogTitle>
            <DialogDescription className="mt-1">
              Wähle aus, was du erstellen möchtest.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="grid grid-cols-2 gap-3 p-6 pt-5 sm:grid-cols-3">
          {ITEMS.map((it, idx) => (
            <button
              key={it.label}
              onClick={() => {
                onOpenChange(false);
                navigate({ to: it.route });
              }}
              style={{ animationDelay: `${idx * 35}ms` }}
              className="group relative flex flex-col items-start gap-3 rounded-xl border border-border/60 bg-card/60 p-4 text-left backdrop-blur-sm transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card hover:shadow-[0_10px_24px_-12px_rgba(37,99,235,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:animate-fade-in-fast"
            >
              <div
                className={`grid h-11 w-11 place-content-center rounded-xl ${it.tint} ring-1 ring-inset ring-border/40 transition-transform group-hover:scale-105`}
              >
                <it.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold tracking-tight">{it.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{it.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
