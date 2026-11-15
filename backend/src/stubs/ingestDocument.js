/**
 * STUB — ingestDocument.js
 *
 * This is a placeholder until Person 2 delivers the real module.
 * Contract:
 *   ingestDocument(documentId: string, filePath: string) -> Promise<void>
 *
 * Person 2's real implementation should:
 *   1. Parse the PDF at filePath
 *   2. Chunk the text
 *   3. Generate embeddings
 *   4. Insert rows into document_chunks (with embedding vectors)
 *   5. Update Document.status to DONE (or FAILED on error)
 *
 * To swap: in src/ai/index.js change the import line — nothing else changes.
 */

import { prisma } from "../db.js";

export async function ingestDocument(documentId, filePath) {
  console.log(`[IngestStub] Starting ingestion for document ${documentId} at ${filePath}`);

  // Mark as PROCESSING immediately
  await prisma.document.update({
    where: { id: documentId },
    data: { status: "PROCESSING", error: null },
  });

  // Simulate a 2-second processing delay
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Mark as DONE
  await prisma.document.update({
    where: { id: documentId },
    data: { status: "DONE" },
  });

  console.log(`[IngestStub] Completed ingestion for document ${documentId}`);
}

