// Step 15 — Release-Bundle: Signaturkompatibilität zwischen
// scripts/build-release.ts und backend/src/system/manifest.ts.
//
// Wir bauen NICHT das echte ZIP (das würde npm run build im Frontend triggern und
// im CI Minuten dauern), sondern verifizieren:
//   1) ein vom Builder signiertes Manifest validiert mit validateManifest gegen denselben Key
//   2) die canonicalJson/Signatur-Formel der beiden Seiten ist bit-identisch
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHmac, randomBytes } from "node:crypto";

const tmp = mkdtempSync(path.join(os.tmpdir(), "mcc-rel-"));
process.env.DATA_DIR = tmp;

let signManifestBackend: typeof import("../src/system/manifest.js").signManifest;
let validateManifest: typeof import("../src/system/manifest.js").validateManifest;
let openDatabase: typeof import("../src/db/index.js").openDatabase;
let closeDatabase: typeof import("../src/db/index.js").closeDatabase;
let getSchemaVersion: typeof import("../src/db/index.js").getSchemaVersion;
let config: typeof import("../src/config.js").config;

beforeAll(async () => {
  const cfg = await import("../src/config.js");
  config = cfg.config;
  // Master-Key bereitstellen
  const keysDir = path.join(tmp, "keys");
  const { mkdirSync } = await import("node:fs");
  mkdirSync(keysDir, { recursive: true, mode: 0o700 });
  writeFileSync(config.keyPath, randomBytes(32));
  // DB initialisieren (validateManifest braucht Schema)
  const db = await import("../src/db/index.js");
  openDatabase = db.openDatabase;
  closeDatabase = db.closeDatabase;
  getSchemaVersion = db.getSchemaVersion;
  openDatabase(config.dbPath);
  const m = await import("../src/system/manifest.js");
  signManifestBackend = m.signManifest;
  validateManifest = m.validateManifest;
});

afterAll(() => {
  closeDatabase?.();
  rmSync(tmp, { recursive: true, force: true });
});

// Replikat aus scripts/build-release.ts (siehe dortigen Hinweis).
function canonicalJson(obj: Record<string, unknown>): string {
  const sorted: Record<string, unknown> = {};
  Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort()
    .forEach((k) => (sorted[k] = obj[k]));
  return JSON.stringify(sorted);
}
function signLikeBuilder(payload: Record<string, unknown>, key: Buffer): string {
  return createHmac("sha256", key)
    .update(canonicalJson({ ...payload, signature: undefined }))
    .digest("hex");
}

describe("Step 15 — Release-Bundle Manifest", () => {
  it("Builder-Signatur ist bit-identisch zur Backend-Signatur", () => {
    const payload = {
      appVersion: "9.9.9",
      schemaVersion: getSchemaVersion(),
      createdAt: "2026-05-02T12:00:00.000Z",
      minBackendVersion: config.version,
    };
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const key = readFileSync(config.keyPath);
    const builderSig = signLikeBuilder(payload, key);
    const backendSigned = signManifestBackend(payload as Parameters<typeof signManifestBackend>[0]);
    expect(builderSig).toBe(backendSigned.signature);
  });

  it("validateManifest akzeptiert ein vom Builder signiertes Manifest", () => {
    const payload = {
      appVersion: "9.9.9",
      schemaVersion: getSchemaVersion(),
      createdAt: new Date().toISOString(),
      minBackendVersion: config.version,
    };
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const key = readFileSync(config.keyPath);
    const signature = signLikeBuilder(payload, key);
    const m = { ...payload, signature };
    const ok = validateManifest(m, { appVersion: config.version, schemaVersion: getSchemaVersion() });
    expect(ok.appVersion).toBe("9.9.9");
  });

  it("Manifest mit hinweise-Feld signiert + validiert korrekt", () => {
    const payload = {
      appVersion: "9.9.10",
      schemaVersion: getSchemaVersion(),
      createdAt: new Date().toISOString(),
      minBackendVersion: config.version,
      hinweise: "Bugfix: Mahnungen",
    };
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const key = readFileSync(config.keyPath);
    const signature = signLikeBuilder(payload, key);
    const ok = validateManifest(
      { ...payload, signature },
      { appVersion: config.version, schemaVersion: getSchemaVersion() },
    );
    expect(ok.hinweise).toBe("Bugfix: Mahnungen");
  });

  it("Setup-Hinweise: dist-release/.gitignore und RELEASE_NOTES.md existieren", () => {
    expect(existsSync(path.resolve(__dirname, "../../dist-release/.gitignore"))).toBe(true);
    expect(existsSync(path.resolve(__dirname, "../../RELEASE_NOTES.md"))).toBe(true);
  });
});
