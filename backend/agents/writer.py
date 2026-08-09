import asyncio
import json
import logging
import re
from typing import List, AsyncGenerator
from models.schemas import SourceChunk, SubQuestion, ResearchDepth
from services.ollama import ollama_service
from services.openrouter import openrouter_service

logger = logging.getLogger(__name__)

WRITER_SYSTEM = """You are a senior research analyst (think McKinsey/Gartner quality bar) writing a
report that will be graded by a brutally honest critic. That critic reserves high scores for
publication-grade work and actively hunts for generic filler, unsupported claims, and thin analysis —
most reports it sees score in the mediocre range, and it does not grade on a curve. To score in the
exceptional range, this report has to actually be exceptional, not just correctly formatted.

RULE ZERO — THE MOST IMPORTANT RULE, ABOVE ALL OTHERS BELOW: every fact, number, date, percentage, or
named entity in this report MUST come from the "Sources" list you are given below. NEVER use your own
background knowledge to supply a number, statistic, company name, or figure that isn't actually present
in the source content — even if you're confident it's realistic or you know something similar to be
generally true. A report full of confident, specific-sounding but invented statistics and fabricated
references is graded WORSE than a shorter, honest report that plainly says the sources don't cover
something. Fabrication is the single fastest way to score near zero — the critic checks whether cited
numbers actually trace back to the numbered sources, and invented figures with invented citations are
treated as fraud, not filler. If you did not read a specific number in the source content below, do not
write that specific number.

CRITICAL RULES:
1. Cite sources using [1], [2], etc. matching the source IDs given below. Every factual sentence needs
   a citation to one of THOSE sources — never a citation to an outlet, report, or study that isn't in
   the source list provided.
2. Every section should include at least one concrete detail (number, date, named entity) — but ONLY if
   that detail is actually present in the source content for that section. If the available sources are
   thin or generic for a sub-question, say so plainly ("the available sources offer limited detail on
   X, but note that...") and work with what's genuinely there — this is more honest, and scores better,
   than inventing specifics to fill the gap.
3. Synthesize across sources, don't summarize one at a time. Where two sources agree, say so and cite
   both [2][5]. Where they diverge or one adds nuance the other lacks, say that explicitly — this kind
   of cross-source analysis is what separates a sharp report from a book-report summary.
4. Structure the report with clear markdown headers (##, ###): start with an Executive Summary,
   cover each sub-question in a dedicated section, end with Conclusions, and close with a References
   list — and the References list must reuse the exact titles/domains from the numbered sources given
   to you, not invented publication names.
5. Use bullet points, bold text, and tables where they genuinely add clarity — not as filler.
6. Open each section with its single most important finding *that the sources actually support*. Do
   not restate the section question as a sentence before answering it.

BANNED — these exact patterns (and anything that reads like them) will be flagged as filler and will
tank the score: "significant developments have been observed", "multiple stakeholders are actively
engaged", "growing momentum and investment", "plays a crucial role", "in today's rapidly evolving
landscape", "it is important to note that", any sentence that would still be true with the topic
swapped out for a different one. If a source genuinely doesn't cover part of a sub-question, say so
plainly ("the available sources don't address X") instead of padding around the gap — an honest gap
scores better than filler."""

# Marker prefix the failure block below always starts with — research.py checks
# for this to detect a live-mode generation failure and avoid scoring the error text.
WRITER_FAILURE_MARKER = "**Report generation failed.**"


# Word count and depth-of-analysis expectations scale with the requested
# research depth — a "quick" report is judged as a tight brief, not a thin
# version of a deep report, so it can still hit a high score within its scope.
_DEPTH_GUIDANCE = {
    ResearchDepth.quick: (
        "STRICT hard limit: 800 words maximum, target 600-800. This is a tight brief, not a shallow "
        "deep-report — every sentence must earn its place. Prioritize the single most important, most "
        "specific finding per section over broad coverage. Plan your section lengths before writing so "
        "the Conclusions and References sections are never cut off."
    ),
    ResearchDepth.standard: (
        "STRICT hard limit: 1300 words maximum, target 900-1300. Cover each sub-question with genuine "
        "depth: 2-3 distinct, cited findings per section, with explicit cross-source synthesis where "
        "sources overlap. Do NOT exceed the limit — a report cut off mid-sentence because it ran too "
        "long scores far worse than a shorter, complete one. Budget your words so Conclusions and "
        "References always fit."
    ),
    ResearchDepth.deep: (
        "STRICT hard limit: 2000 words maximum, target 1400-2000. This is the most thorough tier — "
        "include a comparison table or structured breakdown where the sources support one, address "
        "second-order implications (who is affected, what happens next), and make sure no source is "
        "left uncited if it's relevant to a section. Do NOT exceed the limit — budget your words so "
        "Conclusions and References always fit; an incomplete report scores far worse than a complete "
        "one that covers slightly less ground."
    ),
}


def _build_writer_prompt(
    query: str,
    sub_questions: List[SubQuestion],
    sources: List[SourceChunk],
    depth: ResearchDepth = ResearchDepth.standard,
) -> str:
    sources_text = "\n\n".join([
        f"[{s.id}] {s.title} ({s.domain})\n"
        f"URL: {s.url}\n"
        f"Date: {s.date or 'N/A'}\n"
        f"Content: {s.content[:1500]}"
        for s in sources
    ])

    questions_text = "\n".join([f"{sq.id}. {sq.question}" for sq in sub_questions])
    length_guidance = _DEPTH_GUIDANCE.get(depth, _DEPTH_GUIDANCE[ResearchDepth.standard])

    return f"""Research Topic: "{query}"

Sub-questions to address:
{questions_text}

Sources:
{sources_text}

Target length and depth for this report: {length_guidance}

Write the report now, addressing all sub-questions using only the facts, numbers, and entities that
actually appear in the sources above — never from general knowledge. Before finishing, check every
paragraph for: (a) at least one citation, (b) that every number/date/name in it can be traced back to
the cited source's content (delete or hedge anything that can't), and (c) no banned filler phrasing."""


def _mock_report(query: str, sub_questions: List[SubQuestion], sources: List[SourceChunk]) -> str:
    sections = []
    sections.append(f"# {query.title()}\n")
    sections.append(f"*Generated by Dvelve · {len(sources)} sources cited*\n")

    # Executive Summary
    sections.append("## Executive Summary\n")
    top_source = sources[0] if sources else None
    if top_source:
        sections.append(
            f"This report provides a comprehensive analysis of **{query}**, drawing from {len(sources)} authoritative sources. "
            f"Key findings highlight significant recent developments, including insights from {top_source.domain} [1] "
            f"and other leading institutions. The research synthesizes current knowledge, identifies key trends, "
            f"and outlines future trajectories for this rapidly evolving field.\n"
        )

    # Sections for each sub-question
    for i, sq in enumerate(sub_questions):
        sections.append(f"## {sq.question}\n")
        if sources:
            src_idx = i % len(sources)
            src = sources[src_idx]
            next_src = sources[(src_idx + 1) % len(sources)] if len(sources) > 1 else src
            sections.append(
                f"{src.snippet} [{src.id}]\n\n"
                f"Further research from {next_src.domain} indicates: {next_src.snippet} [{next_src.id}]\n\n"
                f"**Key Points:**\n"
                f"- Significant developments have been observed in this area\n"
                f"- Multiple stakeholders are actively engaged in advancing the field\n"
                f"- Data indicates growing momentum and investment\n"
            )
        else:
            sections.append(
                f"This section addresses the question: *{sq.question}*\n\n"
                f"Based on available knowledge, this is an active area of research with significant implications.\n"
                f"**Key Points:**\n"
                f"- Significant developments have been observed in this area\n"
                f"- Multiple stakeholders are actively engaged in advancing the field\n"
            )

    # Conclusions
    sections.append("## Conclusions\n")
    sections.append(
        f"The analysis of **{query}** reveals a dynamic and rapidly evolving landscape. "
        f"Evidence from {len(sources)} sources converges on several key themes:\n\n"
        f"1. **Accelerating Progress** — The pace of development continues to increase year over year\n"
        f"2. **Cross-Disciplinary Impact** — Advances in this field are reshaping adjacent domains\n"
        f"3. **Future Outlook** — Projections suggest continued growth with significant milestones expected in the next 2-5 years\n\n"
        f"Organizations and researchers in this space should monitor these developments closely and adapt strategies accordingly.\n"
    )

    # References
    sections.append("## References\n")
    for s in sources:
        sections.append(f"[{s.id}] {s.title}. *{s.domain}*. {s.date or '2024'}. [{s.url}]({s.url})\n")

    return "\n".join(sections)


async def _stream_mock(query: str, sub_questions: List[SubQuestion], sources: List[SourceChunk]) -> AsyncGenerator[str, None]:
    report = _mock_report(query, sub_questions, sources)
    chunk_size = 8
    for i in range(0, len(report), chunk_size):
        yield report[i:i + chunk_size]
        await asyncio.sleep(0.02)


async def run_writer_stream(
    query: str,
    sub_questions: List[SubQuestion],
    sources: List[SourceChunk],
    model: str,
    llm_provider: str = "mock",
    depth: ResearchDepth = ResearchDepth.standard,
) -> AsyncGenerator[str, None]:
    """Yields markdown tokens one by one for SSE streaming.

    llm_provider is one of "mock" | "ollama" | "openrouter":
    - "mock": stream the pre-built offline report — no LLM needed.
    - "ollama" (local/offline): best-effort local generation. If it fails
      before any tokens were streamed, fall back to the mock report so
      offline mode always produces *something* — the core "works fully
      offline" guarantee. A failure mid-stream (rare) can't be cleanly
      un-streamed, so it's surfaced as an error instead.
    - "openrouter" (online/cloud): never falls back to mock — the whole
      point of online mode is real generation, so a failure here is a real
      failure the user needs to see and act on (bad/missing API key, no
      credits, model unavailable, etc.).
    """
    if llm_provider == "mock":
        async for chunk in _stream_mock(query, sub_questions, sources):
            yield chunk
        return

    service = ollama_service if llm_provider == "ollama" else openrouter_service
    allow_mock_fallback = llm_provider == "ollama"

    error_detail = "Unknown error"
    token_count = 0
    try:
        prompt = _build_writer_prompt(query, sub_questions, sources, depth)
        async for token in service.generate_stream(
            model, prompt, system=WRITER_SYSTEM
        ):
            token_count += 1
            yield token
        if token_count > 0:
            return
        error_detail = (
            f"Model `{model}` returned no output. Ensure it is pulled in Ollama (`ollama pull {model}`)."
            if llm_provider == "ollama"
            else f"Model `{model}` returned no output from OpenRouter."
        )
    except RuntimeError as e:
        error_detail = str(e)
    except Exception as e:
        error_detail = f"Streaming failed: {e}"

    if allow_mock_fallback and token_count == 0:
        # Nothing was streamed yet, so it's safe to swap in the full mock
        # report. A mid-stream failure (token_count > 0) can't be cleanly
        # un-streamed, so it falls through to the error marker instead.
        logger.warning("Writer (ollama/%s) failed, falling back to mock report: %s", model, error_detail)
        async for chunk in _stream_mock(query, sub_questions, sources):
            yield chunk
        return

    # Surface the actual error clearly in the report
    yield (
        f"\n\n> {WRITER_FAILURE_MARKER}\n"
        f"> {error_detail}\n"
    )
