
# Phase C — Mahnwesen (Frontend + Mock)

## Was Mahnwesen heißt — kurz

Wenn ein Kunde eine Rechnung nicht zahlt, erinnerst du ihn nacheinander höflicher → bestimmter → letzter. Heute hast du **eine** Mahn-Vorlage und einen Button „Mahnung senden". Das reicht nicht: du brauchst Stufen, automatische Erkennung wer dran ist, und Übersicht, damit nichts durchrutscht.

## Ziel von Phase C

1. **3 Mahnstufen** statt einer (Erinnerung → 1. Mahnung → 2. Mahnung)
2. **Automatik:** Rechnungen werden selbst „überfällig", wenn Fälligkeitsdatum überschritten — ohne dass du klickst
3. **Mahn-Dashboard:** eine Seite, die dir zeigt „diese 7 Rechnungen sind dran" mit jeweils der passenden Stufe
4. **Historie pro Rechnung:** wann wurde welche Stufe versendet, mit welcher Frist
5. **Mahngebühren** optional pro Stufe (z.B. 5 € ab Stufe 2)

---

## Konzept: Die 3 Stufen

| Stufe | Wann fällig | Ton | Mahngebühr (Default) | Neue Frist |
|---|---|---|---|---|
| **0 · Zahlungserinnerung** | 3 Tage nach Fälligkeit | freundlich | 0 € | +7 Tage |
| **1 · 1. Mahnung** | 10 Tage nach Erinnerung | bestimmt | 5 € | +7 Tage |
| **2 · 2. Mahnung (letzte)** | 10 Tage nach 1. Mahnung | letzte Aufforderung | 10 € | +7 Tage |

Alle Werte (Tage, Gebühren, Texte) **konfigurierbar in Einstellungen**.

Nach Stufe 2: Rechnung bekommt Status „Inkasso-Übergabe vorgeschlagen" — keine weitere automatische Mahnung. Du entscheidest manuell.

---

## Was die UI macht

### 1. Mahn-Dashboard (neue Seite `/mahnungen`)

Zentrale Übersicht — die wichtigste neue Seite:

```text
┌────────────────────────────────────────────────────┐
│ Mahnwesen                                          │
│                                                    │
│ Heute fällig: 7 Rechnungen · Summe offen: 4.230 € │
│                                                    │
│ ▸ Erinnerung (3)         ▸ 1. Mahnung (2)         │
│ ▸ 2. Mahnung (1)         ▸ Inkasso-reif (1)       │
│                                                    │
│ ┌──────────────────────────────────────────────┐  │
│ │ RE-2025-014 · Müller GmbH                    │  │
│ │ 850 € · 12 Tage überfällig · → Erinnerung   │  │
│ │ [Mahnung vorbereiten]                        │  │
│ ├──────────────────────────────────────────────┤  │
│ │ RE-2025-009 · Schmidt KG                     │  │
│ │ 1.200 € · 25 Tage · letzte Mahnung verschickt│  │
│ │ → für Inkasso vorschlagen                    │  │
│ └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

Filter nach Stufe, Sortierung nach „am dringendsten zuerst".

Sidebar-Eintrag „Mahnungen" mit Badge-Zahl (Anzahl überfällige Rechnungen) — fällt sofort ins Auge.

### 2. Rechnungs-Detailseite — erweiterte Mahn-Sektion

Statt einem einzigen Button:
- Zeigt nächste fällige Stufe als Primary-Button („1. Mahnung versenden")
- Mahn-Historie kompakt: „Erinnerung am 12.04. · 1. Mahnung am 22.04."
- Manuell überspringen oder Stufe wiederholen möglich (Dropdown)

### 3. Versand-Dialog (Erweiterung)

Beim Mahnungs-Versand:
- Dropdown „Stufe" oben (vorausgewählt: nächste fällige)
- Vorlage wechselt automatisch mit Stufe
- Mahngebühr-Hinweis sichtbar („+ 5 € Mahngebühr")
- Neue Frist-Datum vorausgefüllt

### 4. Einstellungen → neuer Tab „Mahnwesen"

- 3 Stufen konfigurieren: Bezeichnung, Tage, Gebühr, Frist
- Auto-Vorschlag an/aus (wenn aus: Mahnungen rein manuell)
- Pro Stufe eigene E-Mail-Vorlage zuordnen

---

## Logik-Regeln (für die Automatik)

- Status `versendet` + Fälligkeit überschritten → wird automatisch `ueberfaellig`
- Wenn Zahlung erfasst (auch teilweise) → Mahnstufe pausiert bis nächste Fälligkeit der Restsumme
- Wenn voll bezahlt → Mahnkette beendet, alle Mahnungen bleiben in Historie
- Storniert → Mahnkette beendet
- „Tage seit Fälligkeit" wird live berechnet, nicht gespeichert

---

## Sichtbare Änderungen — Liste

**Neue Dateien**
- `src/routes/mahnungen.tsx` — Dashboard
- `src/components/mahnung/MahnDashboard.tsx`
- `src/components/mahnung/MahnHistorie.tsx`
- `src/components/mahnung/MahnStufenEinstellungen.tsx`
- `src/lib/mahnung/regeln.ts` — Berechnet aktuelle Stufe pro Rechnung

**Erweiterte Dateien**
- `types.ts` — neue Felder: `mahnungen[]` auf Rechnung, `MahnStufe`-Konfig
- `seed.ts` — 3 Standard-Vorlagen, Standard-Stufen-Config, Beispiel-überfällige Rechnungen
- `backend.ts` — Endpoints für Mahnstufen-Config, Mahnungs-Versand mit Stufe
- `useApi.ts` — Hooks für Mahn-Daten
- `EmailVersandDialog.tsx` — Stufen-Auswahl
- `rechnungen.$id.tsx` — Mahn-Sektion neu
- `einstellungen.tsx` — Tab „Mahnwesen"
- `AppSidebar.tsx` — neuer Eintrag mit Badge
- `index.tsx` (Dashboard) — Kachel „Mahnungen offen"

---

## Technische Details

- **Stufenermittlung** (`bestimmeAktuelleStufe(rechnung, config)`): rein berechnet aus `faelligkeitsdatum`, Mahn-Historie und Konfiguration. Keine doppelte Datenhaltung.
- **MahnVorgang**-Datenmodell: `{ id, rechnungId, stufe: 0|1|2, versendetAm, neueFrist, gebuehr, emailVersandId }` — referenziert `EmailVersand` aus Phase B für Audit-Trail.
- **Backend-Mock** simuliert „heute = Datum X" mittels existierender `now()`-Helper, sodass Beispieldaten realistisch überfällig wirken.
- **Mahngebühr** wird **nicht** in Rechnungs-Positionen geschrieben (Original bleibt unverändert), sondern nur im Mahn-Brief-Text als zusätzlicher Betrag angezeigt — sauberer für Buchhaltung.
- **Keine Cron-Jobs nötig im Frontend**: Auto-Status-Update läuft beim App-Öffnen / Query-Refresh über `regeln.ts`. Echte Cron kommt im Backend (Pi).

---

## Was NICHT in Phase C ist

- Echter E-Mail-Versand (kommt im Backend)
- Inkasso-API-Anbindung (manuell, Status-Markierung reicht)
- Verzugszinsen-Berechnung (kann in Phase F nachgereicht werden, falls gewünscht)
- SMS-Mahnungen

---

## Reihenfolge der Umsetzung

1. Datenmodell + Mock-Backend + Regeln-Engine
2. Einstellungs-Tab „Mahnwesen" mit 3 Stufen
3. 3 Standard-Vorlagen in Seed
4. Mahn-Dashboard `/mahnungen` + Sidebar-Badge
5. Rechnungs-Detailseite Mahn-Sektion + Historie
6. Versand-Dialog Stufen-Erweiterung

Wenn der Plan passt, schreibe „los Phase C" und ich baue alles in einem Rutsch.
