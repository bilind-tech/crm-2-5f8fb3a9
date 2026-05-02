// PDF-Endpoints für Belege.
import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { requireAuth } from "../auth/middleware.js";
import { renderAngebotPdf, renderRechnungPdf, invalidatePdfCache } from "../pdf/belegPdf.server.js";

function etagFor(hash: string): string {
  return `"${hash}"`;
}

export async function belegePdfRoutes(app: FastifyInstance): Promise<void> {
  app.register(async (scoped) => {
    scoped.addHook("preHandler", requireAuth);

    async function handlePdf(
      art: "angebot" | "rechnung",
      id: string,
      ifNoneMatch: string | undefined,
      reply: import("fastify").FastifyReply,
    ) {
      const result = art === "angebot" ? await renderAngebotPdf(id) : await renderRechnungPdf(id);
      if (!result) {
        reply.status(404).send({ error: "not-found" });
        return;
      }
      const etag = etagFor(result.hash);
      if (ifNoneMatch && ifNoneMatch === etag) {
        reply.status(304).header("ETag", etag).send();
        return;
      }
      reply
        .status(200)
        .header("Content-Type", "application/pdf")
        .header("Content-Length", String(result.buffer.length))
        .header("Content-Disposition", `inline; filename="${encodeURIComponent(result.dateiname)}"`)
        .header("ETag", etag)
        .header("Cache-Control", "private, max-age=0, must-revalidate")
        .send(result.buffer);
    }

    function handleMeta(
      result: { hash: string; dateiname: string; buffer: Buffer; fromCache: boolean } | null,
      reply: import("fastify").FastifyReply,
    ) {
      if (!result) {
        reply.status(404).send({ error: "not-found" });
        return;
      }
      reply.send({
        etag: result.hash,
        dateiname: result.dateiname,
        groesseBytes: result.buffer.length,
        fromCache: result.fromCache,
        sha256: crypto.createHash("sha256").update(result.buffer).digest("hex").slice(0, 16),
      });
    }

    // ---- Angebote ----
    scoped.get<{ Params: { id: string } }>("/angebote/:id/pdf", async (req, reply) => {
      await handlePdf("angebot", req.params.id, req.headers["if-none-match"] as string | undefined, reply);
    });
    scoped.get<{ Params: { id: string } }>("/angebote/:id/pdf/meta", async (req, reply) => {
      handleMeta(await renderAngebotPdf(req.params.id), reply);
    });
    scoped.post<{ Params: { id: string } }>("/angebote/:id/pdf/regenerieren", async (req, reply) => {
      invalidatePdfCache("angebot", req.params.id);
      handleMeta(await renderAngebotPdf(req.params.id), reply);
    });

    // ---- Rechnungen ----
    scoped.get<{ Params: { id: string } }>("/rechnungen/:id/pdf", async (req, reply) => {
      await handlePdf("rechnung", req.params.id, req.headers["if-none-match"] as string | undefined, reply);
    });
    scoped.get<{ Params: { id: string } }>("/rechnungen/:id/pdf/meta", async (req, reply) => {
      handleMeta(await renderRechnungPdf(req.params.id), reply);
    });
    scoped.post<{ Params: { id: string } }>("/rechnungen/:id/pdf/regenerieren", async (req, reply) => {
      invalidatePdfCache("rechnung", req.params.id);
      handleMeta(await renderRechnungPdf(req.params.id), reply);
    });
  });
}
