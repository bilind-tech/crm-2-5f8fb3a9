---
name: Backend Step 1 Hardening
description: Step 1 Härtung — Username-Enumeration weg, Cookie-Refresh, Setup-Token-TTL, Owner-Check Sessions, Patch-Semantik, Tests
type: feature
---

# Step 1 Hardening — Status: ✅ implementiert + 10 Vitest grün

## Sicherheit
- Login-Antwort bei 401 enthält NUR `{error:"invalid-credentials"}` — keine Lockout-Daten mehr (verhinderte Username-/State-Enumeration).
- Konstantzeit-Login: bei nicht-existierendem User wird Dummy-Argon2-Hash verifiziert (`getDummyHash`).
- Setup-Token: TTL 24h, Datei-Format `{token, createdAt}`, alte Tokens automatisch regeneriert. Warnung im Log wenn > 1h alt.
- Cookie-Refresh: bei jedem Sliding-Update wird `setSessionCookie` mit neuem maxAge aufgerufen (Helper in `auth/middleware.ts`).
- CORS: Production-Boot bricht hart ab wenn `CORS_ORIGINS` nicht explizit gesetzt ist. Dev mit `*` loggt Warnung.
- Owner-Check Sessions: `deleteSessionForUser(token, userId)` — Cross-User-Revoke → 404.

## Funktional
- `patchArea` validiert erst gegen Partial-Schema, dann merged, dann Full-Schema → leerer String wird beibehalten (kein silent revert auf Default).
- Numerische Settings nutzen `z.coerce.number()` → `"465"` aus Form-Inputs wird akzeptiert.
- Settings-Cache komplett entfernt (KISS, < 0.1ms SQLite-Read mit WAL+PK).
- Touch-Throttle wird beim Boot aus `auth_session.last_seen_at` warm geladen (`warmTouchCacheFromDb`).
- `userCount()` mit In-Memory-Cache `setupCompleteCache` → `markSetupComplete()` nach Setup.

## Frontend
- `client.ts`: Prefix-Routing (`/auth/`, `/einstellungen/`) statt Whitelist. Mock-Override-Liste für noch nicht migrierte Sub-Pfade.
- Neuer AuthMode `backend-offline`: wenn Backend-URL explizit gesetzt aber Backend offline → eigener Screen mit Retry, KEIN stiller Mock-Fallback.
- LockScreen: PasswordInput mit Eye-Toggle + Caps-Lock-Detection. Lockout-UI „Konto gesperrt bis HH:MM".
- `isBackendUrlExplicit()` neu in `backendUrl.ts`.

## Cleanup
- Migration 003: zusätzliche Indexe (`audit_log(action,at)`, `audit_log(user_id,at)`, `auth_lockout(locked_until)`).
- Audit-Retention: 180 Tage, im Background-Sweep alle 10 min (`purgeOldAuditEntries`).
- Lockout-Cleanup: alte Einträge älter 24h ohne aktive Sperre (`purgeOldLockouts`).
- `/health/detail` (auth-only): Counts, Disk-Free, Memory.

## Tests (`backend/test/auth.spec.ts`, vitest)
10 Tests grün:
1. Frische DB → 409 needs-setup
2. Setup mit Token → User + Cookie
3. 401 enthält keine Lockout-Daten
4. Nicht-existierender User → identischer 401-Body
5. 5 Fehlversuche → 423 Locked
6. Korrekter Login (andere IP) → 200 + Cookie
7. PATCH `firma {iban: ""}` → leer bleibt leer
8. PATCH `smtp {port: "465"}` → coerced zu 465
9. Cross-User-Revoke → 404
10. Erneuter Setup → 409 already-setup

Lauf: `cd backend && npm test`

## Bekannte Einschränkungen (bleiben)
- 2FA noch nicht implementiert (späterer Schliff)
- `/smtp/test` aktuell nur TCP-Connect, echter Send kommt mit Step 6
