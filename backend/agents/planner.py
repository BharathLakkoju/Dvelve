import json
import re
from typing import List
from models.schemas import SubQuestion, PlannerResult, ResearchDepth
from services.ollama import ollama_service

DEPTH_QUESTION_COUNT = {
    ResearchDepth.quick: 3,
    ResearchDepth.standard: 5,
    ResearchDepth.deep: 8,
}

PLANNER_SYSTEM = """You are an expert research planner. Your job is to decompose a user's research topic into specific, focused sub-questions that together will produce a comprehensive research report.

For each sub-question, also provide a concise web search query.

Respond ONLY with valid JSON in this exact format:
{
  "sub_questions": [
    {"id": 1, "question": "...", "search_query": "..."},
    {"id": 2, "question": "...", "search_query": "..."}
  ]
}

Do not include any explanation or text outside the JSON."""


def _mock_planner(query: str, depth: ResearchDepth) -> PlannerResult:
    """Fallback mock planner when Ollama is unavailable."""
    count = DEPTH_QUESTION_COUNT[depth]
    templates = [
        ("What is the current state and recent developments in {q}?", "latest developments {q} 2024"),
        ("What are the key challenges and limitations of {q}?", "{q} challenges problems limitations"),
        ("How does {q} compare to alternative approaches?", "{q} vs alternatives comparison"),
        ("What are the economic and social impacts of {q}?", "{q} economic social impact"),
        ("What does the future hold for {q}?", "{q} future trends predictions 2025 2026"),
        ("Who are the leading researchers and institutions working on {q}?", "{q} leading researchers institutions"),
        ("What are the ethical considerations around {q}?", "{q} ethics concerns risks"),
        ("What practical applications exist for {q} today?", "{q} real world applications use cases"),
    ]
    sub_questions = []
    for i in range(min(count, len(templates))):
        q_tmpl, sq_tmpl = templates[i]
        sub_questions.append(SubQuestion(
            id=i + 1,
            question=q_tmpl.format(q=query),
            search_query=sq_tmpl.format(q=query),
        ))
    return PlannerResult(sub_questions=sub_questions, total_questions=len(sub_questions))


async def run_planner(
    query: str,
    model: str,
    depth: ResearchDepth,
    offline_mode: bool,
) -> PlannerResult:
    if offline_mode:
        return _mock_planner(query, depth)

    count = DEPTH_QUESTION_COUNT[depth]
    prompt = f"""Research topic: "{query}"

Generate exactly {count} focused sub-questions and search queries for this topic."""

    try:
        available = await ollama_service.is_available()
        if not available:
            return _mock_planner(query, depth)

        raw = await ollama_service.generate(model, prompt, system=PLANNER_SYSTEM)
        # Extract JSON from response
        match = re.search(r'\{[\s\S]*\}', raw)
        if match:
            data = json.loads(match.group())
            sub_questions = [
                SubQuestion(**sq) for sq in data.get("sub_questions", [])
            ]
            return PlannerResult(
                sub_questions=sub_questions,
                total_questions=len(sub_questions),
            )
    except Exception:
        pass

    return _mock_planner(query, depth)
