"""Cross-encoder reranker with graceful fallback when the model is unavailable."""
import logging
from typing import List, Dict

logger = logging.getLogger(__name__)

try:
    from sentence_transformers import CrossEncoder
    _CE_OK = True
except Exception:  # pragma: no cover - heavy optional dependency
    CrossEncoder = None
    _CE_OK = False


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
            # Fallback: keep RRF order, normalise score so downstream confidence works
            for i, hit in enumerate(hits):
                hit["rerank_score"] = max(0.0, hit.get("score", 0)) / (1 + i * 0.1)
            return hits[:top_k]

        pairs = [[query, hit["text"]] for hit in hits]
        try:
            scores = self.model.predict(pairs)
        except Exception:
            logger.exception("Rerank prediction failed")
            return hits[:top_k]

        for hit, score in zip(hits, scores):
            hit["rerank_score"] = float(score)
        hits.sort(key=lambda x: x.get("rerank_score", 0), reverse=True)
        return hits[:top_k]


reranker = Reranker()
