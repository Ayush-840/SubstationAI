"""Cross-encoder reranker with graceful fallback when the model is unavailable."""

import logging
import math
from typing import List, Dict

logger = logging.getLogger(__name__)

try:
    from sentence_transformers import CrossEncoder

    _CE_OK = True
except Exception:  # pragma: no cover - heavy optional dependency
    CrossEncoder = None
    _CE_OK = False


def _sigmoid(x: float) -> float:
    """Map a raw logit to (0, 1) so confidence stays calibrated."""
    try:
        return 1.0 / (1.0 + math.exp(-x))
    except OverflowError:
        return 0.0 if x < 0 else 1.0


class Reranker:
    def __init__(self):
        self.model = None
        if _CE_OK:
            try:
                self.model = CrossEncoder("BAAI/bge-reranker-base", max_length=512)
            except Exception:
                logger.warning("bge-reranker-base unavailable; rerank disabled")

    def rerank(self, query: str, hits: List[Dict], top_k: int = 6) -> List[Dict]:
        if not hits:
            return []
        if not self.model:
            # Fallback: normalise RRF scores relative to the best hit into [0, 1]
            max_score = max((h.get("score", 0) or 0 for h in hits), default=0) or 1.0
            for i, hit in enumerate(hits):
                rel = (hit.get("score", 0) or 0) / max_score
                hit["rerank_score"] = max(0.0, min(1.0, rel / (1 + i * 0.05)))
            return hits[:top_k]

        pairs = [[query, hit["text"]] for hit in hits]
        try:
            scores = self.model.predict(pairs)
        except Exception:
            logger.exception("Rerank prediction failed")
            max_score = max((h.get("score", 0) or 0 for h in hits), default=0) or 1.0
            for i, hit in enumerate(hits):
                rel = (hit.get("score", 0) or 0) / max_score
                hit["rerank_score"] = max(0.0, min(1.0, rel / (1 + i * 0.05)))
            return hits[:top_k]

        for hit, score in zip(hits, scores):
            hit["rerank_score"] = _sigmoid(float(score))
        hits.sort(key=lambda x: x.get("rerank_score", 0), reverse=True)
        return hits[:top_k]


reranker = Reranker()
