
# CRM-Frontend für Reinigungsbetrieb (Pi-ready)

Ich baue ein vollständiges React-Frontend mit allen beschriebenen Bildschirmen. Das Backend läuft später separat auf deinem Raspberry Pi 5 (von Claude Code gebaut). Damit beides sauber zusammenspielt, liefere ich gleichzeitig eine **API-Spezifikation** als Markdown — das ist der Vertrag, den dein Pi-Backend erfüllen muss.

## Was du am Ende hast

1. **Lauffähiges Frontend** im Browser — sofort klickbar, mit Demo-Daten
2. **Mock-Modus** (`VITE_USE_MOCK=true`, Standard): alle Daten in-memory im Browser, ideal zum Entwickeln und Demoen
3. **Live-Modus** (`VITE_USE_MOCK=false` + `VITE_API_BASE_URL=http://meinpi.local:3000`): Frontend redet mit deinem Pi-Backend
4. **`API_SPEC.md`** im Repo: jede Route, jeder Request/Response, jeder Statuscode — Übergabe-Dokument für Claude Code
5. **`docs/PI_DEPLOYMENT.md`**: wie du das gebuildete Frontend (`dist/`) auf den Pi packst und z. B. Nginx davorhängst

## Architektur des Frontends

```text
src/
├── routes/                    # TanStack-Router-Seiten
│   ├── __root.tsx            # Layout: Sidebar + Header + Lock-Screen-Gate
│   ├── index.tsx             # Dashboard
│   ├── kunden.tsx / kunden.$id.tsx
│   ├── objekte.tsx / objekte.$id.tsx
│   ├── angebote.tsx / angebote.$id.tsx
│   ├── rechnungen.tsx / rechnungen.$id.tsx
│   ├── dokumente.tsx
│   ├── aktivitaet.tsx
│   └── einstellungen.tsx (+ Tabs als Child-Routes)
├── components/
│   ├── layout/               # Sidebar, Header, LockScreen, NotificationBell, GlobalSearch
│   ├── crm/                  # KundenTable, ObjektCard, PositionsEditor, ZahlungsDialog, …
│   └── ui/                   # shadcn (vorhanden)
├── lib/
│   ├── api/                  # ← Vertrag mit dem Pi-Backend
│   │   ├── client.ts         # fetch-Wrapper, Auth-Header, Fehlerbehandlung
│   │   ├── kunden.ts, objekte.ts, angebote.ts, rechnungen.ts, …
│   │   └── types.ts          # TypeScript-Typen für ALLE Entitäten
│   ├── mock/                 # In-Memory-Backend (gleicher Vertrag wie echtes API)
│   │   ├── store.ts          # localStorage-persistiert
│   │   └── seed.ts           # 1–2 Beispiele pro Entität
│   ├── format.ts             # EUR, dd.mm.yyyy, deutsche Zahlen
│   └── auth.ts               # Lock-Screen-State, Session-Handling
├── hooks/                    # useKunden, useRechnungen, … (TanStack Query)
└── styles.css                # Türkis-Akzent #0E9F8A, hell+dunkel
```

**Wichtig:** Komponenten reden NIE direkt mit `fetch`. Sie nutzen Hooks → Hooks nutzen `lib/api/*` → der Client schaltet anhand der Env-Variable zwischen Mock und echtem Pi-Backend um. Dadurch ist der Wechsel später ein Ein-Zeilen-Switch.

## Auth (verschlüsselt, einfach)

Lock-Screen beim App-Start. Du gibst Master-Passwort ein → POST an `/auth/unlock` → Backend antwortet mit JWT (im **HttpOnly+Secure-Cookie**, vom Pi gesetzt). Frontend hält nur ein „is-unlocked"-Flag im Memory. Auto-Lock nach 30 Min Inaktivität (in Einstellungen änderbar). Im Mock-Modus: lokales Passwort `admin` zum Testen, ebenfalls über denselben Flow.

Das Passwort selbst wird auf dem Pi mit Argon2id gehasht (das ist Backend-Sache, steht in der API-Spec). Über LAN sollte später Nginx mit selbstsigniertem Cert oder Tailscale-HTTPS davor — auch das beschreibe ich in `PI_DEPLOYMENT.md`.

## Bildschirme

**Lock-Screen** — zentriertes Logo + Passwortfeld, kein Header/Sidebar.

**Dashboard** — Kennzahlen-Karten (aktive Kunden/Objekte, offene Angebote/Rechnungen, Außenstände EUR), Umsatz-Chart 12 Monate (Recharts, brutto/netto-Toggle, Zeitraum-Filter), Warnungs-Liste (überfällige Rechnungen mit Tagen, alte offene Angebote, Kunden mit kumulierten Außenständen), letzte Aktivitäten, Quick-Action-Buttons.

**Kunden** — Liste mit Suche/Filter/Tags. Detailseite mit Stammdaten (inline editierbar), Tabs für Ansprechpartner, Objekte, Angebote, Rechnungen, Dokumente, Notizen. Roter Banner bei überfälligen Rechnungen. Firma/Privat umschaltbar mit dynamischen Pflichtfeldern. Kundennummer auto.

**Objekte** — Liste + Detail mit allen Reinigungs-spezifischen Feldern (Frequenz, Tage Mo–So Multi-Select, Zugangsinfo, m², Stockwerke, Vor-Ort-Ansprechpartner verlinkt zum Kunden).

**Angebote** — Editor mit Positionen-Tabelle (Beschreibung, Menge, Einheit, Einzelpreis, Steuersatz, Zeilensumme, Gesamt). Vorlagen-Buttons fügen Standard-Positionen ein. Intro/Outro aus Textvorlagen. Status-Workflow (Entwurf → Versendet → Angenommen/Abgelehnt/Abgelaufen). Aktionen: PDF-Vorschau (iframe vom Backend), per E-Mail senden (Dialog), in Rechnung umwandeln (1 Klick → neue Rechnung mit kopierten Positionen, verlinkt), duplizieren, archivieren.

**Rechnungen** — Wie Angebote, plus Zahlungs-Dialog (mehrere Teilzahlungen mit Datum/Betrag/Methode/Referenz), Resthö̈he wird live berechnet, Status springt automatisch (Teilbezahlt/Bezahlt). „Als bezahlt markieren"-Schnellbutton. Überfällig-Logik visuell + im Dashboard.

**Dokumente** — Drag-&-Drop-Upload, Zuordnung zu Kunde+Objekt, Typ-Filter, Browser-Vorschau über vom Backend gelieferte URL.

**Globale Suche** — Cmd/Ctrl+K → Command-Dialog (shadcn `Command`). Sucht parallel über alle Entitäten via `/search?q=`.

**Benachrichtigungs-Glocke** — Header rechts, Badge mit Anzahl ungelesener, Popover-Liste mit Sprung-Links.

**Einstellungen** — Tabs: Firmendaten (inkl. Logo-Upload), Erscheinungsbild (Theme + Akzentfarbe), Nummernkreise (Präfix-Builder mit `{YYYY}` `{####}`-Platzhaltern + Live-Preview), Positionsvorlagen (CRUD), Textvorlagen (CRUD mit Platzhalter-Hilfe `{kunde.name}` etc.), E-Mail/SMTP (Strato-Felder + Testmail-Button), Backup (Download-Button, Auto-Backup-Konfig, Wiederherstellen-Upload), Aktivitätsverlauf (Filter), Sicherheit (Passwort ändern, Auto-Lock-Timer).

**Quick-Create** — Schwebender „+"-Button rechts unten + Cmd+N → öffnet Dialog mit Tabs (Kunde/Objekt/Angebot/Rechnung/Dokument).

## Design

- Akzentfarbe **Türkis #0E9F8A** (sauber, frisch, branchentypisch — falls du eine andere willst, einfach sagen)
- Helles + dunkles Theme, umschaltbar in den Einstellungen, OS-Default als Start
- Inter-Schrift, großzügige Abstände, abgerundete Karten, dezente Schatten
- Deutsche Lokalisierung durchgängig: `1.234,56 €`, `30.04.2026`, Mo–So, ISO-Wochen wo sinnvoll

## API-Vertrag (Auszug — vollständig in `API_SPEC.md`)

```text
POST   /auth/unlock              { password } → 204 + Set-Cookie
POST   /auth/lock                → 204
GET    /me                       → { unlockedAt, autoLockMinutes }

GET    /kunden?q=&status=&tag=   → Kunde[]
POST   /kunden                   → Kunde
GET    /kunden/:id               → KundeMitRelationen
PATCH  /kunden/:id               → Kunde
DELETE /kunden/:id               → 204 | 409 (wenn verknüpft)

… analog: /objekte, /angebote, /rechnungen, /dokumente, /ansprechpartner, /notizen

POST   /angebote/:id/in-rechnung-umwandeln  → Rechnung
GET    /angebote/:id/pdf                     → application/pdf
POST   /angebote/:id/senden                  → 204
POST   /rechnungen/:id/zahlungen             → Zahlung
GET    /rechnungen/:id/pdf                   → application/pdf

GET    /dashboard/kennzahlen                 → { aktiveKunden, … }
GET    /dashboard/umsatz?von=&bis=           → ChartPunkt[]
GET    /dashboard/warnungen                  → Warnung[]

GET    /search?q=                            → SuchTreffer[]
GET    /aktivitaeten?typ=                    → Aktivitaet[]
GET    /benachrichtigungen                   → Benachrichtigung[]
PATCH  /benachrichtigungen/:id/gelesen       → 204

GET/PATCH /einstellungen/firma | /smtp | /nummernkreise | /sicherheit
GET/POST/DELETE /einstellungen/positionsvorlagen
GET/POST/DELETE /einstellungen/textvorlagen
POST   /backup/erstellen                     → application/zip
POST   /backup/wiederherstellen (multipart)  → 204
```

Jede Route bekommt in `API_SPEC.md`: Beschreibung, Request-Schema (TypeScript), Response-Schema, Beispiel-Payload, Fehler-Codes. Das ist der einzige Input, den Claude Code braucht.

## Reihenfolge / Phasen

Da du sagst „Frontend vollständig" — ich baue alles in einem Rutsch, aber in dieser logischen Reihenfolge, damit Zwischenstände sinnvoll sind:

1. **Fundament**: Layout (Sidebar + Header), Theme/Akzent, Lock-Screen, Mock-Store, API-Client-Schicht, Routing-Skeleton
2. **Stammdaten**: Kunden + Ansprechpartner + Objekte (Listen, Detailseiten, Inline-Editing, Quick-Create)
3. **Belege**: Angebote (mit Positionseditor + Vorlagen) → Rechnungen (mit Zahlungen) → Umwandlung Angebot→Rechnung → PDF-iframe-Vorschau
4. **Querschnitt**: Dokumente, Globale Suche (Cmd+K), Benachrichtigungs-Glocke, Aktivitätsverlauf, Dashboard-Warnungen + Chart
5. **Einstellungen**: alle Tabs inkl. Vorlagen-Editoren, SMTP-Form, Backup-UI
6. **Auslieferung**: `API_SPEC.md` finalisieren, `PI_DEPLOYMENT.md` schreiben, Mock-Daten polieren

## Stolperfallen, die ich für dich/Claude Code dokumentiere

In `docs/PI_DEPLOYMENT.md` und `API_SPEC.md` notiere ich:

- **`better-sqlite3` auf ARM64 (Pi 5)**: aktuelle Versionen liefern Prebuilds für `linux-arm64`; falls nicht, `npm rebuild better-sqlite3` braucht `build-essential` + `python3`. Pi 5 mit 64-Bit-OS empfohlen.
- **PDF ohne Headless-Chrome**: `pdfmake` oder `pdf-lib` — beide reine JS, kein Puppeteer. Schont RAM (Chromium auf Pi = 500 MB+).
- **SMTP zu Strato**: Port 465 (SSL) ist zuverlässiger als 587/STARTTLS. SPF/Reverse-DNS beachten — sonst landen Mails im Spam. `nodemailer` mit `secure: true`.
- **Datei-Uploads**: Express/Fastify-Body-Limit hochsetzen (Default 1 MB ist zu klein für Belege). Multipart via `busboy` oder `@fastify/multipart`.
- **SQLite-Backups**: Nicht einfach `cp` — `VACUUM INTO` oder `sqlite3 .backup` benutzen, damit konsistent. Cron täglich, Rotation 14 Tage.
- **Zeitzone**: Pi auf `Europe/Berlin` setzen (`timedatectl set-timezone`), sonst stimmen Fälligkeitsberechnungen nicht.
- **CORS**: Backend muss `http://meinpi.local:3000` (oder Origin des Frontends) explizit erlauben + `credentials: true` für Cookie-Auth.
- **Reverse Proxy**: Nginx vor Node, Frontend-`dist/` als statische Dateien, `/api/*` an Node (Port 4000) proxien. Beispiel-Nginx-Config liefere ich mit.

## Was ich NICHT mache

- Kein Backend-Code (das macht Claude Code auf dem Pi)
- Kein echter SMTP-Versand aus Lovable heraus
- Keine echten PDFs in der Cloud-Vorschau (im Mock-Modus zeige ich einen Platzhalter-iframe; echte PDFs kommen später vom Pi)

---

Wenn du auf „Implement plan" klickst, lege ich los und baue alles oben Beschriebene. Sag vorher noch Bescheid, falls die Türkis-Farbe nicht passt — sonst geht's mit #0E9F8A los.
