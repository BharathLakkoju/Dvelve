import json
import os
import random
from typing import List
from models.schemas import SourceChunk, SubQuestion, RetrieverResult, ResearchDepth

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
    """Returns sources. Always uses mock fixtures in offline mode."""
    depth_source_count = {
        ResearchDepth.quick: 5,
        ResearchDepth.standard: 8,
        ResearchDepth.deep: 12,
    }
    target_count = depth_source_count[depth]

    mock_sources = _find_matching_fixture(query)

    # Pad with generic sources if needed
    if len(mock_sources) < target_count:
        generic = _generate_generic_sources(query, target_count - len(mock_sources))
        # Re-index IDs
        for i, s in enumerate(generic):
            s.id = len(mock_sources) + i + 1
        mock_sources.extend(generic)

    sources = mock_sources[:target_count]

    # Simulate slight randomness in relevance scores
    for s in sources:
        s.relevance_score = min(1.0, s.relevance_score + random.uniform(-0.05, 0.05))

    return RetrieverResult(sources=sources, total_sources=len(sources))
