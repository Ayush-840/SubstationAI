import fs from "fs";
import path from "path";
import { z } from "zod";
import { prisma } from "../db.js";
import { config } from "../config.js";
import { uploadDir } from "../middleware/upload.js";
import { ingestDocument } from "../ai/index.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Strip filePath from any Document object before sending to client.
 * Also flatten _count.chunks → chunkCount.
 */
function formatDoc(doc) {
  const { filePath: _fp, _count, ...rest } = doc;
  return { ...rest, chunkCount: _count?.chunks ?? 0 };
}

/**
 * Verify the first 5 bytes of the uploaded file are "%PDF-".
 * Returns true if valid PDF, false otherwise.
 */
function isPdfMagicBytes(absoluteFilePath) {
  let fd;
  try {
    const buf = Buffer.alloc(5);
    fd = fs.openSync(absoluteFilePath, "r");
    const bytesRead = fs.readSync(fd, buf, 0, 5, 0);
    return bytesRead === 5 && buf.toString("ascii") === "%PDF-";
  } catch {
    return false;
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch { /* ignore */ }
    }
  }
}

/** Safe async file delete — ignores ENOENT (already deleted). */
async function safeUnlink(absolutePath) {
  try {
    await fs.promises.unlink(absolutePath);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }
}

/** Fire-and-forget background ingestion. Never awaited in a request handler. */
function runIngestionInBackground(documentId, absoluteFilePath) {
  ingestDocument(documentId, absoluteFilePath).catch(async (err) => {
    console.error(`[Ingest] FAILED for document ${documentId}:`, err.message);
    try {
      await prisma.document.update({
        where: { id: documentId },
        data: { status: "FAILED", error: err.message ?? "Unknown error" },
      });
    } catch (dbErr) {
      console.error("[Ingest] Could not persist FAILED status:", dbErr.message);
    }
  });
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

const EQUIPMENT_TYPES = [
  "Transformer",
  "Reactor",
  "Circuit Breaker",
  "Instrument Transformer",
  "Surge Arrester",
];

const uploadBodySchema = z.object({
  title: z.string().min(1, "title is required"),
  equipmentType: z
    .enum(EQUIPMENT_TYPES, {
      errorMap: () => ({
        message: `equipmentType must be one of: ${EQUIPMENT_TYPES.join(", ")}`,
      }),
    })
    .optional(),
  standard: z.string().optional(),
});

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * POST /api/documents
 * Multipart: file (PDF ≤ 25 MB), title, equipmentType?, standard?
 * - Saves file to uploads/
 * - Validates PDF magic bytes
 * - Creates Document row (PENDING)
 * - Returns 201 immediately
 * - Triggers ingestion in background (no await)
 */
export async function uploadDocument(req, res) {
  // multer has already saved the file; req.file is populated
  if (!req.file) {
    return res.status(400).json({
      error: 'No file uploaded. Send the PDF in the "file" form field.',
    });
  }

  const absolutePath = path.join(uploadDir, req.file.filename);

  // ── PDF magic bytes check ─────────────────────────────────────────────────
  if (!isPdfMagicBytes(absolutePath)) {
    await safeUnlink(absolutePath);
    return res.status(400).json({
      error: "Uploaded file is not a valid PDF (magic byte check failed).",
    });
  }

  // ── Validate body fields ──────────────────────────────────────────────────
  let body;
  try {
    body = uploadBodySchema.parse({
      title: req.body.title,
      equipmentType: req.body.equipmentType || undefined,
      standard: req.body.standard || undefined,
    });
  } catch (zodErr) {
    // Clean up the saved file before propagating the validation error
    await safeUnlink(absolutePath);
    throw zodErr; // asyncHandler → ZodError → 400 in errorHandler
  }

  // Store relative path (portable — resolved at read time via process.cwd())
  const relativeFilePath = path.posix.join(config.uploadDir, req.file.filename);

  const doc = await prisma.document.create({
    data: {
      title: body.title,
      filePath: relativeFilePath,
      equipmentType: body.equipmentType ?? null,
      standard: body.standard ?? null,
      status: "PENDING",
    },
    include: { _count: { select: { chunks: true } } },
  });

  // ── 201 response ──────────────────────────────────────────────────────────
  res.status(201).json({ document: formatDoc(doc) });

  // ── Background ingestion (fires AFTER response is flushed) ────────────────
  runIngestionInBackground(doc.id, absolutePath);
}

/**
 * GET /api/documents
 * Query params: status, equipmentType, search (matches title, case-insensitive)
 */
export async function listDocuments(req, res) {
  const { status, equipmentType, search } = req.query;

  const where = {};
  if (status) where.status = status;
  if (equipmentType) {
    where.equipmentType = { equals: equipmentType, mode: "insensitive" };
  }
  if (search) {
    where.title = { contains: search, mode: "insensitive" };
  }

  const docs = await prisma.document.findMany({
    where,
    orderBy: { uploadedAt: "desc" },
    include: { _count: { select: { chunks: true } } },
  });

  res.json({ documents: docs.map(formatDoc), count: docs.length });
}

/**
 * GET /api/documents/:id
 */
export async function getDocument(req, res) {
  const doc = await prisma.document.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { chunks: true } } },
  });
  if (!doc) return res.status(404).json({ error: "Document not found" });
  res.json({ document: formatDoc(doc) });
}

/**
 * DELETE /api/documents/:id  (ADMIN)
 * Deletes the physical file from disk, then the DB row.
 * Chunks are deleted by DB cascade (onDelete: Cascade in schema).
 */
export async function deleteDocument(req, res) {
  const doc = await prisma.document.findUnique({
    where: { id: req.params.id },
  });
  if (!doc) return res.status(404).json({ error: "Document not found" });

  // Delete file from disk (best-effort — don't block on ENOENT)
  const absolutePath = path.resolve(process.cwd(), doc.filePath);
  await safeUnlink(absolutePath);

  // Delete DB row — chunks cascade
  await prisma.document.delete({ where: { id: req.params.id } });

  res.json({ message: "Document deleted successfully" });
}

/**
 * POST /api/documents/:id/reingest  (ADMIN)
 * Deletes old chunks, resets to PENDING, re-runs ingestion in background.
 * Returns 409 if the document is currently PROCESSING.
 */
export async function reingestDocument(req, res) {
  const doc = await prisma.document.findUnique({
    where: { id: req.params.id },
  });
  if (!doc) return res.status(404).json({ error: "Document not found" });

  if (doc.status === "PROCESSING") {
    return res.status(409).json({
      error:
        "Document is currently being processed. Wait for it to finish before reingesting.",
    });
  }

  // Delete existing chunks explicitly (cascade would also work on row delete,
  // but we're not deleting the Document row — just the chunks)
  await prisma.documentChunk.deleteMany({ where: { documentId: doc.id } });

  // Reset status
  const updated = await prisma.document.update({
    where: { id: doc.id },
    data: { status: "PENDING", error: null },
    include: { _count: { select: { chunks: true } } },
  });

  // 200 response first, then fire background ingestion
  res.json({ message: "Re-ingestion started", document: formatDoc(updated) });

  const absolutePath = path.resolve(process.cwd(), doc.filePath);
  runIngestionInBackground(doc.id, absolutePath);
}
