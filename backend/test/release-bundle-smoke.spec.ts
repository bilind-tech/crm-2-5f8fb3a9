// Step 15b — Release-Bundle Smoke-Test:
// Ruft scripts/build-release.ts mit --skip-frontend auf und verifiziert das
// erzeugte ZIP. Damit fangen wir Regressionen am ZIP-Build früh ab, OHNE den
// teuren Frontend-Build im CI auszulösen.
//
// Übersprungen, wenn die Umgebung keinen Builder ausführen kann (kein npm/tsx).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomBytes } from "node:crypto";

const ROOT = path.resolve(__dirname, "../..");
const tmp = mkdtempSync(path.join(os.tmpdir(), "mcc-rel-smoke-"));
const dataDir = path.join(tmp, "data");
const keysDir = path.join(dataDir, "keys");
const keyPath = path.join(keysDir, "master.key");
const outDir = path.join(tmp, "dist-release-dry");

process.env.DATA_DIR = dataDir;

let validateManifest: typeof import("../src/system/manifest.js").validateManifest;
let openDatabase: typeof import("../src/db/index.js").openDatabase;
let closeDatabase: typeof import("../src/db/index.js").closeDatabase;
let getSchemaVersion: typeof import("../src/db/index.js").getSchemaVersion;
let cfg: typeof import("../src/config.js").config;

let buildOk = false;
let buildErr: Error | null = null;

beforeAll(async () => {
  mkdirSync(keysDir, { recursive: true, mode: 0o700 });
  writeFileSync(keyPath, randomBytes(32));

  const c = await import("../src/config.js");
  cfg = c.config;
  // Master-Key dorthin spiegeln wo validateManifest ihn sucht.
  if (cfg.keyPath !== keyPath) {
    mkdirSync(path.dirname(cfg.keyPath), { recursive: true, mode: 0o700 });
    writeFileSync(cfg.keyPath, readFileSync(keyPath));
  }
  const db = await import("../src/db/index.js");
  openDatabase = db.openDatabase;
  closeDatabase = db.closeDatabase;
  getSchemaVersion = db.getSchemaVersion;
  openDatabase(cfg.dbPath);
  const m = await import("../src/system/manifest.js");
  validateManifest = m.validateManifest;

  try {
    execSync(
      `npx tsx scripts/build-release.ts --skip-frontend --allow-same-version --key=${keyPath} --out=${outDir}`,
      { cwd: ROOT, stdio: "pipe", timeout: 180_000, env: { ...process.env, NODE_ENV: "test" } },
    );
    buildOk = true;
  } catch (e) {
    buildErr = e as Error;
  }
}, 240_000);

afterAll(() => {
  try { closeDatabase?.(); } catch { /* noop */ }
  rmSync(tmp, { recursive: true, force: true });
});

describe("release-bundle smoke", () => {
  it("Builder läuft erfolgreich durch (skip-frontend)", () => {
    if (!buildOk) {
      console.error("[smoke] Builder-Output:", buildErr?.message);
    }
    expect(buildOk, buildErr?.message ?? "").toBe(true);
  });

  it("ZIP wurde erzeugt", () => {
    if (!buildOk) return;
    const files = readdirSync(outDir).filter((f) => f.endsWith(".zip"));
    expect(files.length).toBeGreaterThan(0);
  });

  it("Manifest validiert + ZIP enthält backend/dist/server.js", async () => {
    if (!buildOk) return;
    const JSZip = (await import("jszip")).default;
    const zipFile = readdirSync(outDir).find((f) => f.endsWith(".zip"))!;
    const buf = readFileSync(path.join(outDir, zipFile));
    const zip = await JSZip.loadAsync(buf);

    const manifestEntry = zip.file("manifest.json");
    expect(manifestEntry, "manifest.json fehlt im ZIP").toBeTruthy();
    const manifestRaw = JSON.parse(await manifestEntry!.async("string"));

    // Pflichtfelder
    expect(manifestRaw.appVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(typeof manifestRaw.schemaVersion).toBe("number");
    expect(manifestRaw.signature).toMatch(/^[a-f0-9]{64}$/);

    // Signatur muss mit unserem Key validieren.
    const validated = validateManifest(
      manifestRaw,
      { appVersion: manifestRaw.appVersion, schemaVersion: getSchemaVersion() },
      { erlaubeGleicheVersion: true },
    );
    expect(validated.appVersion).toBe(manifestRaw.appVersion);

    // Backend wirklich gebaut
    const serverEntry = zip.file("backend/dist/server.js");
    expect(serverEntry, "backend/dist/server.js fehlt im ZIP").toBeTruthy();
  });
});
