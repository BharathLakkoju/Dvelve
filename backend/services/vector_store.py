"""
Phase 4 — ChromaDB-backed vector memory for semantic caching of research sources.
Stores source chunks as embeddings so future queries on similar topics reuse them.
Degrades gracefully if chromadb is not installed.
"""

import asyncio
import hashlib
from typing import List

from models.schemas import SourceChunk

try:
    import chromadb
    from chromadb.utils.embedding_functions import DefaultEmbeddingFunction
    _CHROMA_AVAILABLE = True
except ImportError:
    _CHROMA_AVAILABLE = False

_client = None
_collection = None


def _get_collection():
    """Lazy initialization of the persistent ChromaDB collection."""
    global _client, _collection
    if _collection is not None:
        return _collection
    if not _CHROMA_AVAILABLE:
        return None
    try:
        _client = chromadb.PersistentClient(path="./chroma_db")
        _collection = _client.get_or_create_collection(
            name="research_sources",
            embedding_function=DefaultEmbeddingFunction(),
        )
        return _collection
    except Exception:
        return None


def _make_id(url: str, content: str) -> str:
    """Stable content-addressable ID from URL + first 200 chars of content."""
    h = hashlib.md5((url + content[:200]).encode("utf-8", errors="ignore")).hexdigest()
    return f"src_{h}"


async def store_sources(sources: List[SourceChunk], query: str) -> int:
    """Upsert source chunks into the vector store. Returns the number stored."""
    def _store():
        collection = _get_collection()
        if collection is None or not sources:
            return 0

        docs, metas, ids = [], [], []
        for s in sources:
            doc_id = _make_id(s.url, s.content)
            docs.append(s.content[:1500])
            metas.append({
                "title": s.title,
                "url": s.url,
                "domain": s.domain,
                "snippet": s.snippet[:300],
                "date": s.date or "",
                "relevance_score": float(s.relevance_score),
                "source_query": query,
            })
            ids.append(doc_id)

        try:
            collection.upsert(documents=docs, metadatas=metas, ids=ids)
            return len(docs)
        except Exception:
            return 0

    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _store)


async def query_sources(query: str, max_results: int = 6) -> List[SourceChunk]:
    """Retrieve the most semantically relevant sources from vector memory."""
    def _query():
        collection = _get_collection()
        if collection is None:
            return []

        count = collection.count()
        if count == 0:
            return []

        n = min(max_results, count)
        try:
            results = collection.query(query_texts=[query], n_results=n)
        except Exception:
            return []

        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        sources = []
        for i, (doc, meta) in enumerate(zip(documents, metadatas)):
            distance = distances[i] if i < len(distances) else 1.0
            # ChromaDB returns L2 or cosine distances; convert to 0-1 relevance
            relevance = max(0.0, round(1.0 - min(distance, 1.0), 3))
            sources.append(SourceChunk(
                id=i + 1,
                title=meta.get("title", "Cached Source"),
                url=meta.get("url", ""),
                domain=meta.get("domain", ""),
                snippet=meta.get("snippet", ""),
                content=doc,
                relevance_score=relevance,
                date=meta.get("date") or None,
            ))

        return sources

    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _query)


async def get_source_count() -> int:
    """Return the total number of sources stored in vector memory."""
    def _count():
        collection = _get_collection()
        if collection is None:
            return 0
        try:
            return collection.count()
        except Exception:
            return 0

    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _count)
