import json
import math
import os
import random
from typing import List
from models.schemas import SourceChunk, SubQuestion, RetrieverResult, ResearchDepth
from services.web_retriever import search_web
from services.vector_store import query_sources, store_sources

MOCK_FIXTURES_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "mock_fixtures.json")


def _load_fixtures() -> list:
    with open(MOCK_FIXTURES_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _find_matching_fixture(query: str) -> list[SourceChunk]:
    fixtures = _load_fixtures()
    query_lower = query.lower()
    best_match = None
    best_score = 0

    for fixture in fixtures:
        keywords = fixture["topic_keywords"]
        score = sum(1 for kw in keywords if kw in query_lower)
        if score > best_score:
            best_score = score
            best_match = fixture

    # Fall back to first fixture if no keyword matches
    sources_data = (best_match or fixtures[0])["sources"]
    return [SourceChunk(**s) for s in sources_data]


def _generate_generic_sources(query: str, count: int = 5) -> List[SourceChunk]:
    """Generate plausible-looking generic sources when no fixture matches well."""
    domains = [
        ("scholar.google.com", "Google Scholar"),
        ("researchgate.net", "ResearchGate"),
        ("sciencedirect.com", "ScienceDirect"),
        ("springer.com", "Springer"),
        ("semanticscholar.org", "Semantic Scholar"),
    ]
    sources = []
    for i, (domain, org) in enumerate(domains[:count]):
        sources.append(SourceChunk(
            id=i + 1,
            title=f"Research Overview: {query.title()} — {org} Publication",
            url=f"https://www.{domain}/article/{query.lower().replace(' ', '-')}-{i+1}",
            domain=domain,
            snippet=f"A comprehensive study examining {query}. Our analysis covers recent developments, methodological approaches, and future research directions.",
            content=f"This peer-reviewed paper examines {query} through a multi-disciplinary lens. The introduction reviews 50+ papers published between 2020 and 2024. Section 2 presents our primary analysis of current trends. Section 3 discusses implications for practice and policy. Section 4 identifies gaps in existing research and proposes future directions. Key findings include: (1) significant growth in {query} research output, (2) emerging consensus on core principles, and (3) unresolved questions requiring further investigation. The conclusions emphasize the need for interdisciplinary collaboration to advance the field.",
            relevance_score=round(0.95 - i * 0.05, 2),
            date=f"2024-{(i + 1):02d}-15",
        ))
    return sources


async def run_retriever(
    sub_questions: list[SubQuestion],
    query: str,
    depth: ResearchDepth,
    offline_mode: bool,
) -> RetrieverResult:
    """Returns sources. Uses mock fixtures in offline mode; live web + vector memory otherwise."""
    depth_source_count = {
        ResearchDepth.quick: 5,
        ResearchDepth.standard: 8,
        ResearchDepth.deep: 12,
    }
    target_count = depth_source_count[depth]

    # ── Offline mode: use pre-loaded mock fixtures ────────────────────────────
    if offline_mode:
        mock_sources = _find_matching_fixture(query)
        if len(mock_sources) < target_count:
            generic = _generate_generic_sources(query, target_count - len(mock_sources))
            for i, s in enumerate(generic):
                s.id = len(mock_sources) + i + 1
            mock_sources.extend(generic)
        sources = mock_sources[:target_count]
        for s in sources:
            s.relevance_score = min(1.0, s.relevance_score + random.uniform(-0.05, 0.05))
        return RetrieverResult(sources=sources, total_sources=len(sources), cached_count=0)

    # ── Phase 4: Query vector memory for semantically similar cached sources ──
    cached_sources = await query_sources(query, max_results=target_count)
    cached_count = len(cached_sources)

    # ── Phase 2: Fill remaining quota with live DuckDuckGo web retrieval ─────
    web_sources: List[SourceChunk] = []
    remaining = target_count - cached_count
    if remaining > 0:
        subqs_to_search = sub_questions[:3]  # search up to 3 sub-questions
        per_query = math.ceil(remaining / max(len(subqs_to_search), 1))

        seen_urls = {s.url for s in cached_sources}
        for sq in subqs_to_search:
            results = await search_web(sq.search_query, max_results=per_query)
            for s in results:
                if s.url and s.url not in seen_urls:
                    seen_urls.add(s.url)
                    web_sources.append(s)

    # ── Merge, trim, and re-index ─────────────────────────────────────────────
    all_sources = (cached_sources + web_sources)[:target_count]
    for i, s in enumerate(all_sources):
        s.id = i + 1

    # ── Phase 4: Persist new web sources into vector memory ───────────────────
    if web_sources:
        await store_sources(web_sources, query)

    return RetrieverResult(
        sources=all_sources,
        total_sources=len(all_sources),
        cached_count=cached_count,
    )
