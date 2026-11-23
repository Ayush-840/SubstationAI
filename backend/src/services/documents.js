/**
 * src/services/documents.js
 *
 * Thin service layer for document operations.
 * The heavy logic (multer, ingestion) lives in the controller and middleware.
 * This file exists so the folder structure matches the spec and
 * future refactoring has a clear home.
 */

import { prisma } from "../db.js";

/**
 * Update a document's ingestion status and optional error message.
 */
export async function setDocumentStatus(documentId, status, error = null) {
  return prisma.document.update({
    where: { id: documentId },
    data: { status, error: error ?? null },
  });
}

/**
 * Get a document by ID (throws P2025 if not found — caught by errorHandler).
 */
export async function findDocumentById(documentId) {
  return prisma.document.findUniqueOrThrow({ where: { id: documentId } });
}

