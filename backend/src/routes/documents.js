import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { handleUpload } from "../middleware/upload.js";
import {
  uploadDocument,
  listDocuments,
  getDocument,
  deleteDocument,
  reingestDocument,
} from "../controllers/documents.js";

const router = Router();

// All document routes require authentication
router.use(requireAuth);

// ── Read (any logged-in user) ─────────────────────────────────────────────────
router.get("/", asyncHandler(listDocuments));
router.get("/:id", asyncHandler(getDocument));

// ── Write (ADMIN only) ────────────────────────────────────────────────────────
// IMPORTANT: requireRole runs BEFORE handleUpload so unauthorised users never
// touch the multer middleware or the disk.
router.post(
  "/",
  requireRole("ADMIN"),
  handleUpload,            // multer saves file, then calls next()
  asyncHandler(uploadDocument)
);

router.delete("/:id", requireRole("ADMIN"), asyncHandler(deleteDocument));

router.post(
  "/:id/reingest",
  requireRole("ADMIN"),
  asyncHandler(reingestDocument)
);

export default router;

