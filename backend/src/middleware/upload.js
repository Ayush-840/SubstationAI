import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { config } from "../config.js";

// Ensure the upload directory exists at startup
const uploadDir = path.resolve(process.cwd(), config.uploadDir);
fs.mkdirSync(uploadDir, { recursive: true });

// ── Multer disk storage ───────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, uploadDir);
  },
  filename(_req, file, cb) {
    // unique name: uuid + sanitised original extension (always .pdf after validation)
    const ext = path.extname(file.originalname).toLowerCase() || ".pdf";
    cb(null, `${randomUUID()}${ext}`);
  },
});

// ── Multer filter: only allow PDF MIME types ──────────────────────────────────
// (Real PDF magic-byte check happens in the controller after the file is saved)
function fileFilter(_req, file, cb) {
  const allowed = ["application/pdf", "application/x-pdf"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    // Create a typed error so the error middleware can distinguish it
    const err = new Error("Only PDF files are allowed");
    err.code = "INVALID_FILE_TYPE";
    cb(err, false);
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.maxFileSizeMb * 1024 * 1024, // bytes
    files: 1,
  },
});

/**
 * handleUpload — Express middleware that runs multer and converts its errors
 * to clean 400 JSON responses immediately (before the global error handler).
 *
 * Usage in routes:
 *   router.post("/", requireAuth, requireRole("ADMIN"), handleUpload, controller)
 *
 * Role check comes BEFORE this middleware so unauthorised users never touch multer.
 */
export function handleUpload(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (!err) return next();

    // File too large
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        error: `File too large. Maximum allowed size is ${config.maxFileSizeMb} MB.`,
      });
    }

    // Wrong field name (not "file")
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({
        error: 'File must be sent in the "file" field of the multipart form.',
      });
    }

    // Wrong MIME type (set by our fileFilter)
    if (err.code === "INVALID_FILE_TYPE") {
      return res.status(400).json({ error: err.message });
    }

    // Anything else → global error handler
    next(err);
  });
}

/** Absolute path of the uploads directory — exported so controllers can use it */
export { uploadDir };

