## Provisorischer DEV-Schnell-Login-Button

Ein großer sekundärer Button mitten im Login-Screen, der mit einem Klick mit dem aktuellen Passwort `040506` einloggt. Klar als Wegwerf-Code markiert, damit später in 3 Sekunden komplett entfernbar.

### Änderung

**`src/components/layout/LockScreen.tsx`** — direkt unter dem bestehenden „Entsperren"-Button einen zweiten Button einfügen, eingerahmt von expliziten Marker-Kommentaren:

```tsx
{/* DEV-AUTOLOGIN-START — provisorisch, vor Release komplett entfernen (inkl. dieses Blocks). */}
<Button
  type="button"
  size="lg"
  variant="secondary"
  className="h-14 w-full text-base font-semibold"
  disabled={loading}
  onClick={async () => {
    setFehler(null);
    try {
      await unlock("040506");
    } catch (err) {
      setFehler(err instanceof Error ? err.message : "Anmeldung fehlgeschlagen");
    }
  }}
>
  Schnell-Login (DEV)
</Button>
{/* DEV-AUTOLOGIN-END */}
```

### Späteres Entfernen

Alles zwischen `DEV-AUTOLOGIN-START` und `DEV-AUTOLOGIN-END` (inklusive der beiden Marker-Zeilen) löschen — fertig. Keine weiteren Stellen im Code, keine Imports zusätzlich (nutzt nur `Button` + `unlock`, beides ohnehin schon im File).

Keine Sparkles oder Glitzer (Memory-Regel beachtet) — nur ein klarer Text-Button.
