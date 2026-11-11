/**
 * src/services/cache.js
 *
 * Simple in-memory TTL cache for repeated chat questions.
 * No Redis — just a Map with per-entry expiry timestamps.
 *
 * Key   : string  (typically `question::equipmentContext`)
 * Value : { answer, sources, intent }
 */

const cache = new Map(); // key -> { value, expiresAt }

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Get a cached entry. Returns undefined if missing or expired.
 */
export function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

/**
 * Store a value with an optional TTL (ms). Defaults to 5 minutes.
 */
export function cacheSet(key, value, ttlMs = DEFAULT_TTL_MS) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Explicitly remove a key (e.g., after a document update).
 */
export function cacheDelete(key) {
  cache.delete(key);
}

/**
 * Clear everything (useful in tests or on server restart).
 */
export function cacheClear() {
  cache.clear();
}

/**
 * Build a canonical cache key from a question (and optional context).
 * Normalises whitespace and lowercases so "IR test" and "ir test" hit the same slot.
 */
export function buildCacheKey(question, equipmentType = "") {
  const normQ = question.trim().toLowerCase().replace(/\s+/g, " ");
  const normE = equipmentType.trim().toLowerCase();
  return normE ? `${normQ}::${normE}` : normQ;
}

/**
 * Run a lightweight sweep to remove expired entries.
 * Call periodically if you expect the cache to grow large.
 */
export function cachePurgeExpired() {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now > entry.expiresAt) cache.delete(key);
  }
}

/** Returns the number of live (non-expired) entries. */
export function cacheSize() {
  cachePurgeExpired();
  return cache.size;
}

