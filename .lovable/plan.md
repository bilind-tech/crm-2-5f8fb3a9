# Fix: Kunden-Detailseite („Something went wrong" + roher JSON-Text)

## Ursache (sicher diagnostiziert)

Frontend `src/routes/kunden.$id.tsx` greift auf `k.angebote.length`, `k.rechnungen.length`, `k.dokumente.length` und `k.notizen.length` zu (Tab-Zähler & Tabs). Der zugehörige Hook `useKunde` deklariert diese Felder im Typ.

Backend-Endpoint `GET /kunden/:id` (`backend/src/routes/stammdaten.ts:56-68`) liefert aber nur:
```
{ ...kunde, ansprechpartner, objekte, notizen }
```
**`angebote`, `rechnungen`, `dokumente` fehlen komplett.**

Folge:
- Erster Render: `k.angebote.length` → `TypeError: Cannot read properties of undefined` → Root-`errorComponent` zeigt **„Something went wrong"**.
- Bei Reload: gleiches Problem; der rohe JSON-Text oben links ist die Server-Antwort, die TanStack/React beim Crash teilweise als Fallback in das Error-UI durchreicht (bzw. der Error-Boundary-Output enthält den Query-State serialisiert).

Zusätzlich: `k.notizen` wird in `Stammdaten`-Card (Zeile 184–187) als **String** gerendert (`whitespace-pre-wrap`), an anderer Stelle als **Array** (`k.notizen.length`, `k.notizen.map`). Das ist ein latenter Bug, der zumindest aufgeräumt werden sollte.

## Plan

### 1. Backend: fehlende Listen mitliefern
Datei: `backend/src/routes/stammdaten.ts`

- Imports ergänzen:
  - `listAngebote` aus `../belege/angebote-repo.js`
  - `listRechnungen` aus `../belege/rechnungen-repo.js`
  - `listDokumente` aus `../dokumente/repo.js`
- Im Handler `GET /kunden/:id` Response erweitern:
  ```ts
  return {
    ...k,
    ansprechpartner: listAnsprechpartner(k.id),
    objekte: listObjekte(k.id),
    angebote: listAngebote({ kundeId: k.id }),
    rechnungen: listRechnungen({ kundeId: k.id }),
    dokumente: listDokumente({ kundeId: k.id }),
    notizen: listNotizenForKunde(k.id),
  };
  ```
- Filter-Signaturen vorab prüfen (`AngebotFilter`, `RechnungFilter`, `DokumentListFilter`) und ggf. `archiviert: false` setzen, falls Default das verlangt.

### 2. Frontend: defensiv absichern
Datei: `src/routes/kunden.$id.tsx`

- Direkt nach `if (!k) return <NotFoundState … />` Defaults setzen, damit ältere Backend-Versionen (Pi noch nicht aktualisiert) nicht mehr crashen:
  ```ts
  const ansprechpartner = k.ansprechpartner ?? [];
  const objekte = k.objekte ?? [];
  const angebote = k.angebote ?? [];
  const rechnungen = k.rechnungen ?? [];
  const dokumente = k.dokumente ?? [];
  const notizenListe = Array.isArray(k.notizen) ? k.notizen : [];
  ```
  und alle `k.angebote` / `k.rechnungen` / `k.dokumente` / `k.notizen.length|map` durch die lokalen Variablen ersetzen.

### 3. Notizen-Inkonsistenz aufräumen
Im „Tags & Notizen"-Block (Zeile 184–187) wird `k.notizen` als String behandelt. Das ist falsch — `notizen` ist eine Liste von `Notiz`-Objekten. Block ersetzen durch:
- Wenn `notizenListe.length === 0` → „Keine Notizen."
- Sonst kurzer Hinweis „X Notiz(en) — siehe Tab Notizen" (Detail-Anzeige bleibt im Notizen-Tab).

### 4. Verifikation
- `bun run build` muss durchgehen (TS strict).
- Manuell: Kunde Bayer öffnen → Tabs zeigen korrekte Zählerstände (0/0/0 wenn nichts vorhanden), keine Fehlermeldung mehr.
- Auch im aktuellen Zustand (Backend auf Pi noch alt) zeigt die Seite jetzt etwas Sinnvolles, weil Frontend die Defaults greift.

### 5. Deploy-Hinweis (Pi)
Die Backend-Änderung wirkt erst nach `Jetzt aktualisieren` in den Einstellungen (oder Service-Restart mit neuem Build). Bis dahin sorgt Punkt 2 dafür, dass die Seite trotzdem nicht crasht.

## Out of Scope
- Pagination/Limits für die mitgelieferten Listen — Kunden mit hunderten Rechnungen sind aktuell kein Thema; bei Bedarf später `limit` setzen.
- Backend-Tests — bestehende Tests bleiben grün, neue Felder sind additiv.
