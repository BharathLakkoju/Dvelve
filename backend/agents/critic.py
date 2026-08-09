import json
import logging
import random
import re
from typing import List
from models.schemas import CriticResult, SourceChunk
from services.ollama import ollama_service
from services.openrouter import openrouter_service

logger = logging.getLogger(__name__)

# Generic filler phrases the mock/offline writer (and weak live models) lean on.
# A brutally honest critic should flag these as padding, not reward them.
_FILLER_PHRASES = [
    "significant developments have been observed",
    "multiple stakeholders are actively engaged",
    "data indicates growing momentum",
    "active area of research with significant implications",
    "dynamic and rapidly evolving landscape",
    "accelerating progress",
    "cross-disciplinary impact",
]

CRITIC_SYSTEM = """You are a ruthless, brutally honest peer reviewer for research reports. Your job is
to protect readers from mediocre, generic, or unsupported writing — not to be encouraging.

Grading rubric (0.0-10.0, one decimal place):
- 9.0-10.0: reserved for exceptional, publication-grade reports with specific, well-cited evidence,
  sharp analysis, and no filler. This should be RARE.
- 7.0-8.9: solid, specific, well-organized, mostly well-cited, but with minor gaps.
- 5.0-6.9: average — readable but generic in places, thin evidence, or underdeveloped sections.
- 3.0-4.9: weak — vague claims, little real evidence, heavy filler/boilerplate language.
- 0.0-2.9: unacceptable — incoherent, unsupported, or barely addresses the topic.

Penalize hard for: generic filler sentences that could apply to any topic ("significant developments
have been observed", "multiple stakeholders are actively engaged", etc.), unsupported claims with no
citation, missing or thin citations, repetition, and sections that don't actually answer the
sub-questions. Do not inflate the score to be nice. Most reports you see are mediocre and should land
in the 4-7 range.

Respond ONLY with valid JSON in this exact format:
{
  "quality_score": 6.2,
  "strengths": ["...", "..."],
  "suggestions": ["...", "..."]
}

"suggestions" must be concrete, critical, and actionable — not generic encouragement. Do not include
any explanation or text outside the JSON."""


def _build_critic_prompt(report_markdown: str, sources: List[SourceChunk]) -> str:
    return f"""Review the following research report brutally and honestly. It cites {len(sources)} sources
(numbered [1]..[{len(sources)}]).

--- REPORT START ---
{report_markdown[:6000]}
--- REPORT END ---

Grade it according to your rubric."""


def _heuristic_critic(report_markdown: str, sources: List[SourceChunk]) -> CriticResult:
    """Deterministic, harsh fallback scoring used offline or when the LLM critique
    is unavailable/unparseable. Deliberately hard to max out — see CRITIC_SYSTEM
    for the same philosophy applied by the LLM path."""
    lower_report = report_markdown.lower()
    word_count = len(report_markdown.split())
    citation_count = report_markdown.count("[")
    has_executive_summary = "executive summary" in lower_report
    has_conclusions = "conclusion" in lower_report
    has_references = "references" in lower_report
    section_count = report_markdown.count("\n##")
    filler_hits = sum(1 for phrase in _FILLER_PHRASES if phrase in lower_report)

    # Start low — a report has to actively earn a good score, not merely avoid being bad.
    score = 3.0
    if word_count > 500:
        score += 0.7
    if word_count > 800:
        score += 0.4
    if citation_count >= 5:
        score += 0.8
    if citation_count >= 10:
        score += 0.4
    if has_executive_summary:
        score += 0.3
    if has_conclusions:
        score += 0.3
    if has_references:
        score += 0.3
    if section_count >= 3:
        score += 0.4
    if len(sources) >= 8:
        score += 0.4

    # Generic boilerplate is a strong negative signal — cap how far filler-heavy
    # reports (like the offline mock report) can climb.
    score -= filler_hits * 0.6

    score = max(0.5, min(9.5, score + random.uniform(-0.25, 0.25)))
    score = round(score, 1)

    strengths = []
    if has_executive_summary:
        strengths.append("Includes an executive summary")
    if citation_count >= 5:
        strengths.append(f"Cites sources inline ({citation_count} citation markers)")
    if has_conclusions:
        strengths.append("Has a dedicated conclusions section")
    if not strengths:
        strengths.append("Addresses the requested topic at a surface level")

    suggestions = []
    if filler_hits > 0:
        suggestions.append(
            "Remove generic filler sentences (e.g. \"significant developments have been observed\") "
            "and replace them with specific facts, numbers, or dates from the sources"
        )
    if word_count < 600:
        suggestions.append("Expand thin sections with concrete evidence rather than restating the question")
    if citation_count < 5:
        suggestions.append("Add more inline citations — claims without a [n] marker are unverifiable")
    if not has_executive_summary:
        suggestions.append("Add an Executive Summary section at the beginning")
    if section_count < 3:
        suggestions.append("Break the report into more focused sub-sections")
    if len(sources) < 5:
        suggestions.append("Retrieve more sources — the current evidence base is too narrow")
    if not suggestions:
        suggestions.append("Tighten prose and add data visualizations or comparison tables for depth")

    return CriticResult(
        quality_score=score,
        strengths=strengths,
        suggestions=suggestions,
        citation_count=citation_count,
    )


async def run_critic(
    report_markdown: str,
    sources: List[SourceChunk],
    model: str = "llama3:8b",
    llm_provider: str = "mock",
) -> CriticResult:
    """Analyzes report quality and returns a brutally honest score with suggestions.

    llm_provider is one of "mock" | "ollama" | "openrouter". Any failure —
    mock mode, an unreachable local Ollama, or an OpenRouter error — falls
    back to the harsh deterministic heuristic below rather than leaving the
    report unscored. A critic failure doesn't invalidate a successfully
    generated report, so this fallback applies for every provider.
    """
    citation_count = report_markdown.count("[")

    if llm_provider == "mock":
        return _heuristic_critic(report_markdown, sources)

    service = ollama_service if llm_provider == "ollama" else openrouter_service

    try:
        available = await service.is_available()
        if not available:
            return _heuristic_critic(report_markdown, sources)

        prompt = _build_critic_prompt(report_markdown, sources)
        raw = await service.generate(model, prompt, system=CRITIC_SYSTEM)
        match = re.search(r'\{[\s\S]*\}', raw)
        if not match:
            logger.warning("Critic (%s/%s): LLM response had no JSON block, falling back to heuristic. Raw (truncated): %r", llm_provider, model, raw[:300])
        else:
            data = json.loads(match.group())
            score = float(data.get("quality_score", 5.0))
            score = round(max(0.0, min(10.0, score)), 1)
            strengths = [str(s) for s in data.get("strengths", [])][:5] or ["No notable strengths identified"]
            suggestions = [str(s) for s in data.get("suggestions", [])][:5] or ["No specific suggestions"]
            return CriticResult(
                quality_score=score,
                strengths=strengths,
                suggestions=suggestions,
                citation_count=citation_count,
            )
    except Exception as e:
        # Falling back silently here would misrepresent an infra failure (timeout,
        # OOM, bad JSON) as a genuine harsh critique — log it so it's diagnosable
        # rather than indistinguishable from an honest low score.
        logger.warning("Critic (%s/%s) LLM call failed, falling back to heuristic scoring: %s", llm_provider, model, e)

    return _heuristic_critic(report_markdown, sources)
