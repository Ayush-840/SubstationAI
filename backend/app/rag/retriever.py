"""Retriever with optional heavy dependencies.

If chromadb/sentence-transformers are not installed, retrieval falls back to
a catalog-only mode (no document hits) so the API still works.
"""
import logging
import os
import pickle
from typing import Any, Dict, List, Optional

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

try:
    import chromadb
    from chromadb.config import Settings as ChromaSettings
    from rank_bm25 import BM25Okapi
    _CHROMA_OK = True
except Exception:  # pragma: no cover - heavy optional dependency
    chromadb = None
    ChromaSettings = None
    BM25Okapi = None
    _CHROMA_OK = False

try:
    from sentence_transformers import SentenceTransformer
    _ST_OK = True
except Exception:  # pragma: no cover
    SentenceTransformer = None
    _ST_OK = False


class Retriever:
    def __init__(self):
        self.enabled = _CHROMA_OK and _ST_OK
        self.embed_model = None
        self.chroma_client = None
        self.collection = None
        self.bm25 = None
        self.bm25_corpus: list = []
        self.chunk_id_map: list = []
        self._bm25_path = os.path.join(settings.CHROMA_PATH, "bm25_index.pkl")
        if self.enabled:
            try:
                self._init_backend()
            except Exception:
                logger.exception("Retriever backend init failed; running without document retrieval")
                self.enabled = False
        else:
            logger.warning("chromadb/sentence-transformers not installed; document retrieval disabled")

    def _init_backend(self):
        os.makedirs(settings.CHROMA_PATH, exist_ok=True)
        self.embed_model = SentenceTransformer(settings.EMBED_MODEL)
        self.chroma_client = chromadb.PersistentClient(
            path=settings.CHROMA_PATH,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        self.collection = self.chroma_client.get_or_create_collection(
            name="substationiq_chunks",
            metadata={"hnsw:space": "cosine"},
        )
        self._load_bm25()

    def _load_bm25(self):
        if os.path.exists(self._bm25_path):
            with open(self._bm25_path, "rb") as f:
                data = pickle.load(f)
                self.bm25_corpus = data["corpus"]
                self.chunk_id_map = data["chunk_ids"]
                self.bm25 = BM25Okapi(self.bm25_corpus) if self.bm25_corpus else None

    def _save_bm25(self):
        os.makedirs(settings.CHROMA_PATH, exist_ok=True)
        with open(self._bm25_path, "wb") as f:
            pickle.dump({"corpus": self.bm25_corpus, "chunk_ids": self.chunk_id_map}, f)

    def add_chunks(self, chunks):
        if not self.enabled or not chunks:
            return
        texts = [c.text for c in chunks]
        embeddings = self.embed_model.encode(texts).tolist()
        ids = [str(c.id) for c in chunks]
        metadatas = [{
            "document_id": c.document_id if c.document_id is not None else -1,
            "page_start": c.page_start if c.page_start is not None else -1,
            "page_end": c.page_end if c.page_end is not None else -1,
            "section_title": c.section_title or "",
            "equipment_class_id": c.equipment_class_id if c.equipment_class_id is not None else -1,
            "test_id": c.test_id if c.test_id is not None else -1,
        } for c in chunks]
        self.collection.add(ids=ids, embeddings=embeddings, documents=texts, metadatas=metadatas)

        tokenized = [t.split() for t in texts]
        self.bm25_corpus.extend(tokenized)
        self.chunk_id_map.extend(ids)
        self.bm25 = BM25Okapi(self.bm25_corpus)
        self._save_bm25()

    def remove_document_chunks(self, document_id: int):
        if not self.enabled:
            return
        results = self.collection.get(where={"document_id": document_id})
        if results["ids"]:
            self.collection.delete(ids=results["ids"])
        self._rebuild_bm25()

    def _rebuild_bm25(self):
        from app.db.session import SessionLocal
        from app.db.models import Chunk
        db = SessionLocal()
        try:
            all_chunks = db.query(Chunk).all()
            self.bm25_corpus = [c.text.split() for c in all_chunks]
            self.chunk_id_map = [str(c.id) for c in all_chunks]
            self.bm25 = BM25Okapi(self.bm25_corpus) if self.bm25_corpus else None
            self._save_bm25()
        finally:
            db.close()

    def search(
        self,
        query: str,
        equipment_class_id: Optional[int] = None,
        test_id: Optional[int] = None,
        top_k_vector: int = 20,
        top_k_bm25: int = 20,
    ) -> List[Dict[str, Any]]:
        if not self.enabled:
            return []

        where = {}
        if equipment_class_id:
            where["equipment_class_id"] = equipment_class_id
        if test_id:
            where["test_id"] = test_id

        try:
            query_embedding = self.embed_model.encode(query).tolist()
        except Exception:
            logger.exception("Embedding failed")
            return []

        vector_hits: List[Dict[str, Any]] = []
        try:
            vector_results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k_vector, max(self.collection.count(), 1)),
                where=where if where else None,
                include=["documents", "metadatas", "distances"],
            )
            if vector_results["ids"] and vector_results["ids"][0]:
                for i, chunk_id in enumerate(vector_results["ids"][0]):
                    vector_hits.append({
                        "chunk_id": int(chunk_id),
                        "score": 1 - vector_results["distances"][0][i],
                        "text": vector_results["documents"][0][i],
                        "metadata": vector_results["metadatas"][0][i],
                    })
        except Exception:
            logger.exception("Vector search failed")

        bm25_hits: List[Dict[str, Any]] = []
        if self.bm25:
            tokenized_query = query.split()
            if tokenized_query:
                bm25_scores = self.bm25.get_scores(tokenized_query)
                top_indices = sorted(range(len(bm25_scores)), key=lambda i: bm25_scores[i], reverse=True)[:top_k_bm25]
                from app.db.session import SessionLocal
                from app.db.models import Chunk
                db = SessionLocal()
                try:
                    for idx in top_indices:
                        if bm25_scores[idx] <= 0:
                            continue
                        chunk_id = int(self.chunk_id_map[idx])
                        chunk = db.query(Chunk).filter(Chunk.id == chunk_id).first()
                        if not chunk:
                            continue
                        if equipment_class_id and chunk.equipment_class_id != equipment_class_id:
                            continue
                        if test_id and chunk.test_id != test_id:
                            continue
                        bm25_hits.append({
                            "chunk_id": chunk_id,
                            "score": float(bm25_scores[idx]),
                            "text": chunk.text,
                            "metadata": {"document_id": chunk.document_id,
                                         "page_start": chunk.page_start,
                                         "section_title": chunk.section_title},
                        })
                finally:
                    db.close()

        return self._reciprocal_rank_fusion(vector_hits, bm25_hits)

    def _reciprocal_rank_fusion(
        self,
        vector_hits: List[Dict],
        bm25_hits: List[Dict],
        k: int = 60,
    ) -> List[Dict]:
        scores: Dict[int, float] = {}
        for rank, hit in enumerate(vector_hits):
            cid = hit["chunk_id"]
            scores[cid] = scores.get(cid, 0) + 1 / (k + rank + 1)
        for rank, hit in enumerate(bm25_hits):
            cid = hit["chunk_id"]
            scores[cid] = scores.get(cid, 0) + 1 / (k + rank + 1)

        sorted_ids = sorted(scores.keys(), key=lambda x: scores[x], reverse=True)
        all_hits = {h["chunk_id"]: h for h in vector_hits + bm25_hits}
        return [all_hits[cid] for cid in sorted_ids if cid in all_hits]


retriever = Retriever()
