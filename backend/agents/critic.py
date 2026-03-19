import random
from typing import List
from models.schemas import CriticResult, SourceChunk


async def run_critic(report_markdown: str, sources: List[SourceChunk]) -> CriticResult:
    """Analyzes report quality and returns a score with suggestions."""
    word_count = len(report_markdown.split())
    citation_count = report_markdown.count("[") 
    has_executive_summary = "executive summary" in report_markdown.lower()
    has_conclusions = "conclusion" in report_markdown.lower()
    has_references = "references" in report_markdown.lower()
    section_count = report_markdown.count("\n##")

    # Score calculation (0-10)
    score = 5.0
    if word_count > 500:
        score += 1.0
    if word_count > 800:
        score += 0.5
    if citation_count >= 5:
        score += 1.0
    if has_executive_summary:
        score += 0.5
    if has_conclusions:
        score += 0.5
    if has_references:
        score += 0.5
    if section_count >= 3:
        score += 0.5
    if len(sources) >= 8:
        score += 0.5

    score = min(10.0, score + random.uniform(-0.3, 0.3))
    score = round(score, 1)

    strengths = []
    if has_executive_summary:
        strengths.append("Clear executive summary provides strong introduction")
    if citation_count >= 5:
        strengths.append(f"Well-cited report with {citation_count} citation references")
    if word_count > 500:
        strengths.append(f"Comprehensive coverage with {word_count} words")
    if has_conclusions:
        strengths.append("Conclusions section effectively synthesizes findings")
    if not strengths:
        strengths.append("Report provides a baseline overview of the topic")

    suggestions = []
    if word_count < 600:
        suggestions.append("Expand each section with more detailed analysis (target 600+ words)")
    if citation_count < 5:
        suggestions.append("Add more inline citations to strengthen credibility")
    if not has_executive_summary:
        suggestions.append("Add an Executive Summary section at the beginning")
    if section_count < 3:
        suggestions.append("Break the report into more focused sub-sections")
    if len(sources) < 5:
        suggestions.append("Retrieve more sources for broader coverage")
    if not suggestions:
        suggestions.append("Consider adding data visualizations or comparison tables")

    return CriticResult(
        quality_score=score,
        strengths=strengths,
        suggestions=suggestions,
        citation_count=citation_count,
    )
