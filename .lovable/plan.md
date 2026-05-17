## Ursache

Im Lovable-Preview (lovableproject.com) läuft kein Pi-Backend — `localhost:8787` ist offline (siehe Netzwerk-Log: lauter `Load failed`). Der Client fällt deshalb auf den lokalen Mock (`src/lib/api/localPreviewData.ts`) zurück. Dieser Mock kennt für Daueraufträge nur zwei harte Einträge:

```ts
if (cleanPath === "/dauerauftraege") return [] as T;
if (cleanPath === "/dauerauftrag-laeufe") return [] as T;
```

→ Liste immer leer, deshalb zeigt der „Aus Dauerauftrag"-Dialog im Preview nichts an. Backend, Dialog und Hooks sind funktional korrekt — auf dem echten Pi würde es laufen.

Damit du es **im Preview testen und nutzen** kannst, baue ich den Mock zu einem vollständigen In-Browser-Dauerauftrags-Backend aus, das genau das nachbildet, was der Pi macht.

## Lösung — Mock-Backend für Daueraufträge

Erweitere ausschließlich `src/lib/api/localPreviewData.ts` (gleicher localStorage-Store `mcc.localPreview.belege.v1`, Schlüssel ergänzt). Keine Änderungen am Backend, an den Hooks oder am Dialog nötig.

### 1. Store erweitern
```ts
interface PreviewStore {
  angebote: Angebot[];
  rechnungen: Rechnung[];
  dauerauftraege: Dauerauftrag[];           // NEU
  dauerauftragLaeufe: DauerauftragLauf[];   // NEU
  dauerauftragSonderpos: DauerauftragSonderposition[]; // NEU
}
```
Read/Write/Default-Fallbacks aktualisieren.

### 2. POST /rechnungen — Auto-Anlage Dauerauftrag
Im bestehenden `POST /rechnungen`-Handler nach dem Anlegen prüfen:

```ts
const opt = (input.optionen ?? {}) as { wiederkehrend?: boolean; wiederkehrendDetails?: { rhythmus?: string } };
if (opt.wiederkehrend === true) {
  const freq = mapRhythmus(opt.wiederkehrendDetails?.rhythmus); // → monatlich/quartalsweise/halbjaehrlich/jaehrlich
  const da = createPreviewDauerauftrag({
    rechnungId: rechnung.id,
    kundeId: rechnung.kundeId,
    bezeichnung: rechnung.titel,
    positionen: rechnung.positionen,
    rabattGesamt: rechnung.rabattGesamt,
    steuersatz: rechnung.steuersatz,
    frequenz: freq,
    rechnungsdatum: rechnung.rechnungsdatum,
  });
  return { ...rechnung, dauerauftragNeu: { id: da.id, nummer: da.nummer } } as T;
}
```
Damit erscheint der Dauerauftrag sofort nach Anlegen einer wiederkehrenden Rechnung im „Aus Dauerauftrag"-Dialog.

### 3. Neue Mock-Endpoints

| Methode + Pfad | Verhalten |
|---|---|
| `GET /dauerauftraege` | Store-Liste |
| `GET /dauerauftraege/:id` | DA + `laeufe`, `sonderpositionen` |
| `POST /dauerauftraege` | Neuanlage |
| `PATCH /dauerauftraege/:id` | Felder aktualisieren (Bezeichnung, Frequenz, Status, Steuersatz, Rabatt, Notizen — exakt was der Edit-Dialog sendet) |
| `DELETE /dauerauftraege/:id` | Eintrag entfernen |
| `POST /dauerauftraege/:id/sofort-lauf` | **Kern:** erzeugt neue Rechnung im Store (mit `nextBelegnummer`, übernommenen Positionen, Periode in Titel), legt `DauerauftragLauf{status:"erzeugt", periode, rechnungId, erstelltAm}` an. Idempotent: existiert bereits ein Lauf für `(id, periode)` → vorhandenen Lauf zurückgeben (kein Duplikat). |
| `POST /dauerauftraege/:id/pausieren` | Status auf `pausiert` |
| `POST /dauerauftraege/:id/beenden` | Status auf `beendet`, `laufzeitBis` setzen |
| `GET /dauerauftrag-laeufe` | optional `?status=` filtern |
| `POST /dauerauftrag-sonderpositionen` | Append |
| `DELETE /dauerauftrag-sonderpositionen/:id` | Remove |
| `GET /einstellungen/dauerauftrag` | Default-Einstellungen liefern |
| `PATCH /einstellungen/dauerauftrag` | Werte merken |

### 4. Periode-Mapping
Analog `backend/src/dauerauftrag/periode.ts`: `YYYY-MM` (monatlich), `YYYY-Qn` (quartal), `YYYY-Hn` (halbjahr), `YYYY` (jahr). Bei `sofort-lauf` ohne `periode` → aktuelle Periode aus heutigem Datum + DA-Frequenz.

## Verifikation

1. Im Preview: neue Rechnung anlegen → Häkchen „Wiederkehrend" + Rhythmus wählen → speichern.
2. In Rechnungs-Liste „Aus Dauerauftrag" anklicken → Dauerauftrag wird angezeigt mit Frequenz, Brutto/Lauf, Status-Pill.
3. Periode wählen, Häkchen setzen, „Erzeugen (1)" → Toast „1 Rechnung erzeugt" → neue Rechnung erscheint in der Liste; zweiter Erzeugungs-Versuch derselben Periode zeigt Warn-Badge „bereits erzeugt".
4. Bleistift-Icon → Edit-Dialog → Bezeichnung/Frequenz/Status ändern → Speichern → Liste reflektiert Änderung.

## Out of Scope
- Echte E-Mail-Versendung (im Preview generell nicht).
- PDF-Generierung im Mock (war auch vorher nicht da).
- Persistenz über Geräte hinweg — bleibt browser-lokal, wie der gesamte Preview-Store.
