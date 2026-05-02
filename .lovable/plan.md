
## Teil 0 — WICHTIG: Audit „Werden irgendwo automatisch E-Mails versendet?"

Ich habe den ganzen Code durchsucht. Stand jetzt:

**Stellen, an denen tatsächlich `sendMail` aufgerufen wird:**
1. `backend/src/email/worker.ts` — pollt alle 30 s die `email_versand`-Queue und sendet alles, was drin liegt. Wird in `server.ts` per `startEmailWorker()` automatisch gestartet.
2. `backend/src/routes/email.ts` Zeile 135 — manueller Test-Versand-Endpunkt aus den SMTP-Einstellungen (nur auf Klick „Test-Mail senden").

**Wer legt etwas in die Queue (`enqueueVersand`)?**
- `backend/src/routes/email.ts` Zeile 111 — wenn der User im Frontend im EmailVersandDialog auf „Senden" klickt. **Bewusste User-Aktion. OK.**
- `backend/src/mahnung/automatik.ts` Zeile 121 — der Mahn-Cron (`startMahnScheduler`). **Genau das, was du nicht willst.**

**Andere Cron-Jobs (kein Mail-Versand, nur interne Aktionen):**
- `fristen-cron.ts` — erzeugt nur In-App-Benachrichtigungen (Glocken-Icon), schickt keine Mail.
- `belege/scheduler.ts` — markiert Rechnungen intern als „überfällig", schickt keine Mail.
- `drive/upload-worker.ts` — Google-Drive-Upload, keine Mail.
- `backup/scheduler.ts` — SQLite-Snapshot, keine Mail.

**Konsequenz für Block B (Mahn-Automatik) — wird NICHT komplett gelöscht, aber stillgelegt:**
- `startMahnScheduler()` aus `server.ts` auskommentieren/entfernen → Cron tickt nie.
- In `backend/src/mahnung/automatik.ts` einen harten Guard einbauen: `if (quelle === "cron") return earlyExit` — selbst wenn jemand den Scheduler später wieder anwirft, wird kein Mail-Enqueue passieren.
- Frontend: im Mahnwesen-Tab den Bereich „Automatik aktiv / Cron-Zeit" ausblenden (Code bleibt liegen, nur die UI wird versteckt + Hinweis „Mahnungen werden nur manuell verschickt").
- Memory-Eintrag setzen: **„NIEMALS automatischer E-Mail-Versand. Mails nur nach expliziter User-Aktion im EmailVersandDialog."**

→ Das mache ich als ersten Schritt vor der eigentlichen Upload-UX.

---

## Teil 1 — Bestandsaufnahme Dokumenten-Upload (was es schon gibt)

- `src/components/dokumente/DokumentUploader.tsx` — Drag & Drop / Klick / kompakter Button. Lädt nacheinander hoch, zeigt nur Toast.
- `src/lib/dokument/upload.ts` — Komprimiert Bilder (max. 1600px JPEG q0.8), prüft 20 MB, baut FormData, fällt auf Mock zurück.
- `src/components/dokumente/HandyScanDialog.tsx` — Handy-Scan via Upload-Session.
- `src/components/dokumente/DokumentBearbeitenDialog.tsx` — Meta-Edit.
- `src/components/dokumente/DokumentViewer.tsx` — Vorschau.
- Backend `backend/src/routes/dokumente.ts` + `013_dokumente.sql` — Multipart-Endpunkt, Frist-Felder, Drive-Sync.

**Schwächen heute:**
- Kein sichtbarer Fortschritt pro Datei (nur „Wird hochgeladen…").
- Bei mehreren Dateien sieht man weder welche fertig sind noch welche fehlgeschlagen sind.
- Keine Vorschau vor dem Hochladen, keine Möglichkeit aus dem Stapel einzelne wieder zu entfernen.
- Meta (Kunde, Objekt, Typ, Frist, Betrag, steuerrelevant) muss erst nachträglich im Bearbeiten-Dialog gesetzt werden → für Quittungen zu umständlich.
- Validierung (zu groß, falscher Typ) verschwindet als Toast — keine zweite Chance.
- Drag&Drop nur in der Drop-Zone, nicht auf der ganzen Seite.
- Mobil: der große Drop-Bereich ist auf dem Handy unnötig groß.

---

## Teil 2 — Plan für die neue Upload-UX

**Ziel:** Ein Stapel-Upload-Flow, der robust, übersichtlich und schnell ist — auch für 10 Quittungen auf einmal — ohne dass automatisch Mails oder sonstige Aktionen ausgelöst werden.

### 2.1 Neue Komponente `DokumentUploadPanel`
Ersetzt die heutige große Drop-Zone auf `/dokumente`. Aufbau:

```text
+---------------------------------------------------------+
|  [Icon] Dateien hierher ziehen oder klicken             |
|         Bilder oder PDF · max. 20 MB · mehrere möglich  |
+---------------------------------------------------------+
|  Wenn Dateien ausgewählt → Stapel-Liste darunter:       |
|                                                         |
|  [Thumb] rechnung_1.pdf       1.2 MB   [✓ fertig]       |
|  [Thumb] foto.jpg → 0.6 MB    komprimiert  [▓▓▓░] 78%   |
|  [Thumb] zu_gross.png         24 MB    [✗ zu groß]  [×] |
|                                                         |
|  Gemeinsame Meta (klappt auf, optional):                |
|    Kunde [Select]  Objekt [Select]  Typ [Select]        |
|    Fällig am [Datum]  Betrag [€]  ☐ steuerrelevant      |
|                                                         |
|  [Alle hochladen]   [Liste leeren]                      |
+---------------------------------------------------------+
```

**Verhalten:**
- Auswahl per Klick, Drag&Drop in die Zone, **oder** Drag-Drop irgendwo aufs Fenster (globaler Overlay).
- Sofort nach Auswahl: Vorschau-Thumb (Bild via `URL.createObjectURL`, PDF generisches Icon), Validierung (Typ + Größe), Komprimierungs-Hinweis bei Bildern.
- Pro Datei klare Status-Chips: `wartet | komprimiert | lädt hoch X% | fertig | fehler`.
- Einzelne Dateien per `×` aus dem Stapel entfernen, einzelne fehlgeschlagene per „↻ Erneut" wiederholen.
- Optional gemeinsame Meta wird auf alle Dateien gleichzeitig angewendet (ist heute der Hauptfrust).
- „Alle hochladen" mit Concurrency 3 (nicht alle parallel — Pi soll Luft behalten).
- Nach Abschluss: kompakter Summary-Toast `„7 hochgeladen, 1 fehlgeschlagen"` + die fehlgeschlagene Karte bleibt sichtbar bis sie gelöscht/wiederholt wird.

### 2.2 Globaler Drop-Overlay
Eine `<GlobalDropZone />` einmal im `__root.tsx`, die nur auf `/dokumente` und `/kunden/:id` aktiv ist. Wenn der User Dateien irgendwohin aufs Fenster zieht, blendet sich ein blasses Overlay mit „Hier ablegen, um zu Dokumenten hinzuzufügen" ein. Beim Drop landet alles im `DokumentUploadPanel`-Stapel.

### 2.3 Fortschritt vom Upload-Request
Der heutige `piApi.post` mit `FormData` liefert keinen Progress. Ich erweitere `piClient` um eine `postWithProgress`-Variante (XHR statt fetch), die `onUploadProgress(loaded, total)` zurückgibt. Verhältnis 0–100 % geht an die Stapel-Karte. Funktioniert sowohl Live (Pi) als auch im Mock (sofort 100 %).

### 2.4 Validierung & Sicherheit
- Whitelist MIME-Types: `image/jpeg, image/png, image/webp, image/heic, application/pdf`.
- Max 20 MB **vor** Komprimierung prüfen, danach informativ zeigen „1.2 MB → 0.4 MB komprimiert".
- Dateiname trimmen, gefährliche Zeichen entfernen.
- Zod-Schema für Meta (Kunde-ID, Objekt-ID, Datum, Betrag).

### 2.5 Mobil-Spezifika
- Auf `<sm` schrumpft die Drop-Zone zu einem kompakten Button-Block: `[📷 Vom Handy scannen]  [📎 Dateien wählen]`.
- Der Stapel rendert als gestapelte Karten (genau wie die bestehende Dokument-Karte), inkl. Wisch-Geste „Entfernen".
- `<input accept="image/*,application/pdf" capture>` erlaubt direkten Kamera-Zugriff.

### 2.6 Wiederverwendbarkeit
- `DokumentUploadPanel` bekommt Props `kundeId?`, `objektId?`, `defaultFaelligAm?`, `onUploaded?(dokumente: Dokument[])`.
- Wird genutzt auf `/dokumente` (groß), Kunden-Detail-Tab „Dokumente" (mittel), Objekt-Detail (mittel), und ersetzt den `compact`-Button im PageHeader durch einen Button, der das Panel-Sheet auf Mobile öffnet.

### 2.7 Backend (klein, nicht-invasiv)
Der Multipart-Endpunkt `/dokumente` existiert bereits. Anpassungen:
- Nur Header-Feld `Content-Length`-Validierung früh ablehnen (>22 MB → 413), damit der Pi nicht erst alles reinliest.
- MIME-Whitelist serverseitig spiegeln (Defense in Depth).
- Kein neuer Endpunkt nötig — das spart Migration.

### 2.8 Was NICHT passiert (explizit)
- Kein automatisches Verschicken irgendeiner Mail — auch nicht „Dokument xy ist eingegangen".
- Keine automatische OCR / KI-Erkennung der Quittung in dieser Stufe (kann später).
- Keine Änderung an Drive-Auto-Upload — der läuft schon und ist gewünscht.

---

## Teil 3 — Reihenfolge der Umsetzung

1. **Auto-Mail-Sperre** (Teil 0) — Scheduler-Start raus, Guard rein, UI ausblenden, Memory-Eintrag.
2. **`postWithProgress`** im `piClient`.
3. **`DokumentUploadPanel`** komplett neu (Stapel + Status + Meta-Bulk).
4. **`GlobalDropZone`** im `__root.tsx`.
5. **Integration**: `/dokumente`, Kunden-Detail, Objekt-Detail umstellen. Alter `DokumentUploader` als dünner Wrapper für Rückwärtskompatibilität.
6. **Backend-Härtung** (413 + MIME-Whitelist).
7. **Smoketest in Preview** (auch wenn Backend offline ist → Mock-Pfad).

---

## Technische Notizen
- Komponentenpfad: `src/components/dokumente/DokumentUploadPanel.tsx`, `src/components/dokumente/GlobalDropZone.tsx`.
- Concurrency-Helfer: kleine `runWithConcurrency(items, n, fn)`-Util in `src/lib/util/concurrency.ts`.
- XHR-Wrapper: `src/lib/api/piClient.ts` → `postWithProgress<T>(path, formData, onProgress)`.
- State-Modell für Stapel:
  `type StapelItem = { id; file; previewUrl?; status: "wartet"|"komprimiert"|"laedt"|"fertig"|"fehler"; progress: number; fehler?: string; result?: Dokument }`.
- Keine neuen DB-Tabellen, keine Migration.
- Tests: kleiner Vitest für `runWithConcurrency` und für die MIME/Größen-Validierung.

---

**Fragen, die ich beim Bauen entscheiden würde — sag Bescheid wenn du anders willst:**
- Concurrency-Limit `3` (statt `1` heute) — passt für Pi?
- Bild-Komprimierung weiter auf 1600 px / q0.8? Bei Quittungen reicht das locker.
- Soll der globale Drop-Overlay nur auf `/dokumente` aktiv sein oder app-weit (überall „nimm das auf")?
