from typing import List
from models.schemas import SourceChunk, RankerResult, ResearchDepth
from services.ollama import ollama_service


def _rule_based_rank(sources: List[SourceChunk]) -> List[SourceChunk]:
    """Simple rule-based ranking by relevance score, deduplicating by domain."""
    seen_domains = set()
    ranked = []
    # Sort by relevance score descending
    sorted_sources = sorted(sources, key=lambda s: s.relevance_score, reverse=True)
    for source in sorted_sources:
        # Allow max 2 sources per domain
        domain_count = sum(1 for s in ranked if s.domain == source.domain)
        if domain_count < 2:
            ranked.append(source)
    # Re-index IDs
    for i, s in enumerate(ranked):
        s.id = i + 1
    return ranked


async def run_ranker(
    sources: List[SourceChunk],
    model: str,
    offline_mode: bool,
) -> RankerResult:
    original_count = len(sources)
    ranked = _rule_based_rank(sources)
    return RankerResult(
        ranked_sources=ranked,
        deduplicated_count=original_count - len(ranked),
    )
