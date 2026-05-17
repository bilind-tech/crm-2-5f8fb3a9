// Eingebettete Ansicht der externen Stundenzettel-App per iframe.
// Lädt über Backend-Reverse-Proxy (/extern/stundenzettel/), damit
// Mixed-Content, LAN-Erreichbarkeit und X-Frame-Options gelöst sind.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Clock,
  ExternalLink,
  RefreshCw,
  Settings as SettingsIcon,
  PlugZap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { useStundenzettelUrl, useStundenzettelEmbedUrl } from "@/lib/stundenzettel/config";

export const Route = createFileRoute("/stundenzettel")({ component: Page });

type ProbeResult =
  | { ok: true }
  | { ok: false; kind: "not-configured" | "upstream-unreachable" | "network" | "other"; status?: number };

function Page() {
  const { url } = useStundenzettelUrl();
  const embedUrl = useStundenzettelEmbedUrl();
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);

  const probe = useQuery<ProbeResult>({
    queryKey: ["stundenzettel", "probe", embedUrl, reloadKey],
    enabled: !!embedUrl,
    retry: false,
    staleTime: 0,
    queryFn: async () => {
      try {
        const res = await fetch(embedUrl, { method: "GET", credentials: "include" });
        if (res.ok) return { ok: true };
        if (res.status === 503) return { ok: false, kind: "not-configured", status: 503 };
        if (res.status === 502) return { ok: false, kind: "upstream-unreachable", status: 502 };
        return { ok: false, kind: "other", status: res.status };
      } catch {
        return { ok: false, kind: "network" };
      }
    },
  });

  useEffect(() => {
    if (!url || !probe.data?.ok) return;
    setLoaded(false);
    setSlow(false);
    const t = setTimeout(() => {
      setSlow((prev) => (loaded ? prev : true));
    }, 8000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, reloadKey, probe.data?.ok]);

  if (!url) {
    return (
      <div className="space-y-6">
        <PageHeader title="Stundenzettel" subtitle="Externe App für Arbeitszeit-Erfassung." />
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-10 text-center">
          <Clock className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="mb-1 text-lg font-semibold">Noch nicht eingerichtet</h2>
          <p className="mx-auto mb-5 max-w-md text-sm text-muted-foreground">
            Die Stundenzettel-App läuft als eigener Dienst auf dem Pi. Hinterlege ihre Adresse in
            den Einstellungen, dann erscheint sie hier eingebettet.
          </p>
          <Button asChild className="gap-1.5 rounded-full px-5">
            <Link to="/einstellungen">
              <SettingsIcon className="h-4 w-4" />
              Zu den Einstellungen
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const probeData = probe.data;
  const showError = probeData && !probeData.ok;

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Stundenzettel</h1>
          <span className="truncate text-xs text-muted-foreground">{url}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-full"
            onClick={() => setReloadKey((k) => k + 1)}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Neu laden
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-full"
            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            In neuem Tab
          </Button>
        </div>
      </div>

      {showError ? (
        <ErrorState
          kind={probeData!.kind}
          url={url}
          onRetry={() => setReloadKey((k) => k + 1)}
        />
      ) : (
        <div className="relative flex-1 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {(!loaded || probe.isLoading) && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex justify-center p-3">
              <div className="pointer-events-auto rounded-full border border-border bg-background/90 px-4 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur">
                {slow ? (
                  <span>
                    Lädt länger als gewohnt — falls die Ansicht leer bleibt,{" "}
                    <button
                      type="button"
                      className="underline underline-offset-2 hover:text-foreground"
                      onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
                    >
                      im neuen Tab öffnen
                    </button>
                    .
                  </span>
                ) : (
                  <span>Stundenzettel wird geladen …</span>
                )}
              </div>
            </div>
          )}
          {probe.data?.ok && (
            <iframe
              key={reloadKey}
              src={embedUrl}
              title="Stundenzettel"
              className="h-full w-full"
              onLoad={() => {
                setLoaded(true);
                setSlow(false);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ErrorState({
  kind,
  url,
  onRetry,
}: {
  kind: "not-configured" | "upstream-unreachable" | "network" | "other";
  url: string;
  onRetry: () => void;
}) {
  const titel =
    kind === "not-configured"
      ? "Noch nicht konfiguriert"
      : kind === "upstream-unreachable"
        ? "Stundenzettel-Server nicht erreichbar"
        : kind === "network"
          ? "Backend nicht erreichbar"
          : "Unerwarteter Fehler";

  const text =
    kind === "not-configured"
      ? "Im Backend ist keine Stundenzettel-Adresse hinterlegt. Trage die URL in den Einstellungen ein."
      : kind === "upstream-unreachable"
        ? `Das Backend kann den Stundenzettel-Dienst unter ${url} nicht erreichen. Prüfe, ob der Dienst läuft und die Adresse stimmt.`
        : kind === "network"
          ? "Das CRM-Backend antwortet nicht. Prüfe die Backend-Verbindung in den Einstellungen."
          : "Der Stundenzettel-Server hat unerwartet geantwortet.";

  return (
    <div className="flex-1 overflow-auto rounded-2xl border border-border bg-card p-8 shadow-sm">
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-content-center rounded-full bg-muted">
            <PlugZap className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{titel}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={onRetry} className="gap-1.5 rounded-full px-5">
            <RefreshCw className="h-4 w-4" />
            Erneut versuchen
          </Button>
          <Button
            variant="outline"
            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
            className="gap-1.5 rounded-full px-5"
          >
            <ExternalLink className="h-4 w-4" />
            In neuem Tab
          </Button>
          <Button asChild variant="outline" className="gap-1.5 rounded-full px-5">
            <Link to="/einstellungen">
              <SettingsIcon className="h-4 w-4" />
              Adresse ändern
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
