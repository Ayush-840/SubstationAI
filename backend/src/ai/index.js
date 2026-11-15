/**
 * src/ai/index.js — AI module gateway
 *
 * This file is the ONLY place that decides whether to use stubs or
 * Person 2's real AI modules. To swap, change the two import lines below.
 *
 * ─── HOW TO SWAP (when Person 2 delivers their modules) ───────────────────
 *
 *  BEFORE (stubs):
 *    export { getAnswer }      from "../stubs/getAnswer.js";
 *    export { ingestDocument } from "../stubs/ingestDocument.js";
 *
 *  AFTER (real AI):
 *    export { getAnswer }      from "../../ai/getAnswer.js";
 *    export { ingestDocument } from "../../ai/ingestDocument.js";
 *
 *  Person 2's modules must live at backend/../ai/ (i.e., /ai/ at repo root)
 *  and export functions with EXACTLY these signatures:
 *
 *    getAnswer(question: string, history: {role, content}[])
 *      -> Promise<{ answer: string, sources: [{title,page,snippet}], intent: string }>
 *
 *    ingestDocument(documentId: string, filePath: string)
 *      -> Promise<void>
 * ──────────────────────────────────────────────────────────────────────────
 */

// ← Change these two lines when swapping to real AI modules
export { getAnswer }      from "../stubs/getAnswer.js";
export { ingestDocument } from "../stubs/ingestDocument.js";

