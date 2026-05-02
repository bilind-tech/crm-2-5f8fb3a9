---
name: backend-step5-pdf
description: Server-side PDF-Rendering auf dem Pi (Step 5) — pdfmake, Cache, Invalidation, Endpoints, Frontend-Hook-Fallback
type: feature
---

## Architektur

- **Renderer**: `backend/src/pdf/printer.ts` (pdfmake mit Standard-Helvetica, keine externen Fonts).
- **Layout-Port**: `backend/src/pdf/layout.ts` — pixel-identisch zum Frontend `src/lib/pdf/belegPdf.ts` (Angebote + Rechnungen).
- **Render-Façade**: `backend/src/pdf/belegPdf.server.ts` mit `renderAngebotPdf(id)` / `renderRechnungPdf(id)` / `invalidatePdfCache(art, id)`. Liefert `{ buffer, hash, dateiname, fromCache }` oder `null` (404).
- **Cache**: `backend/src/pdf/cache.ts` — Datei-basiert in `${dataDir}/pdf-cache/{angebot|rechnung}/{id}-{hash}.pdf`. SHA256 über Beleg-JSON + Kunde + Firma + Logo-Fingerprint. Beim Miss: alte `${id}-*` Dateien werden gelöscht.
- **Invalidation**: `backend/src/belege/events.ts` (lightweight emitter) → `wirePdfCacheInvalidation()` in `backend/src/pdf/wireup.ts`. Trigger: `angebote-repo`, `rechnungen-repo`, `zahlungen`, `status` rufen `emitBelegMutated(art, id)`.
- **Firma-Context**: `backend/src/pdf/firma.ts` — liest `setting.firma` + Logo aus `${dataDir}/branding/`.

## Endpoints (alle hinter `requireAuth`)

- `GET /angebote/:id/pdf` und `/rechnungen/:id/pdf` → `application/pdf`
  - Header: `ETag` (= Cache-Hash), `X-Pdf-Cache: hit|miss`, `Content-Disposition` mit `filename` (ASCII-fallback) + `filename*=UTF-8''…`
  - Unterstützt `If-None-Match` → 304
  - `Cache-Control: private, max-age=0, must-revalidate`
- `GET /…/pdf/meta` → `{ etag, dateiname, groesseBytes, fromCache, sha256 }`
- `POST /…/pdf/regenerieren` → invalidiert + meta

CORS exponiert: `ETag`, `X-Pdf-Cache`, `Content-Disposition`.

## Frontend-Integration

- `src/lib/pdf/backendPdf.ts` → `fetchBackendPdf(art, id, signal?)`.
  - Liefert `null`, wenn `isBackendUrlExplicit() === false` (Demo-Modus) oder Backend offline / nicht-OK.
- `src/hooks/useBelegPdf.ts` → versucht zuerst Backend-PDF, sonst Browser-Generator (`generateAngebotPdf`/`generateRechnungPdf` aus `src/lib/pdf/belegPdf.ts`). Beide Hooks nutzen `AbortController` für sauberen Cleanup.

## Tests

`backend/test/pdf.spec.ts` (5 Tests, alle grün):
- gültige `%PDF-`-Bytes + Belegnummer/Kundenname im Dateinamen
- 2. Render kommt aus Cache (gleiche Bytes, `fromCache: true`)
- Mutation invalidiert (neuer Hash, alte Cache-Datei weg)
- Rechnung rendert ebenfalls
- unbekannte ID → `null`
