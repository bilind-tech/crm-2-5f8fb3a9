// Tagesjob für überfällige Rechnungen. Wird beim Backup-Scheduler-Tick mit aufgerufen.
import { markOverdueRechnungen } from "./status.js";

let timer: NodeJS.Timeout | null = null;

export function startBelegeScheduler(intervalMs: number = 60 * 60_000): void {
  if (timer) return;
  // Sofort einmal laufen
  try {
    markOverdueRechnungen();
  } catch {
    // ignore — Tabellen evtl. noch nicht angelegt
  }
  timer = setInterval(() => {
    try {
      markOverdueRechnungen();
    } catch {
      // schweigend — wird im nächsten Tick erneut versucht
    }
  }, intervalMs);
  timer.unref?.();
}

export function stopBelegeScheduler(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
