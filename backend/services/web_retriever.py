"""
Phase 2 — Live web retrieval using DuckDuckGo search + BeautifulSoup page scraping.
Falls back gracefully if the network is unavailable or the library is missing.
"""

import asyncio
from typing import List
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

from models.schemas import SourceChunk

try:
    from duckduckgo_search import AsyncDDGS
    _DDG_AVAILABLE = True
except ImportError:
    _DDG_AVAILABLE = False

_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)


async def search_web(search_query: str, max_results: int = 5) -> List[SourceChunk]:
    """Search DuckDuckGo and enrich results with fetched page text."""
    if not _DDG_AVAILABLE:
        return []

    try:
        async with AsyncDDGS() as ddgs:
            raw = await ddgs.atext(search_query, max_results=max_results)
    except Exception:
        return []

    if not raw:
        return []

    # Fetch page content for each result concurrently
    urls = [r.get("href", "") for r in raw]
    contents = await asyncio.gather(*[_fetch_content(u) for u in urls], return_exceptions=True)

    sources: List[SourceChunk] = []
    for i, (r, page_text) in enumerate(zip(raw, contents)):
        url = r.get("href", "") or ""
        title = r.get("title", "Untitled")
        snippet = r.get("body", "")
        domain = _extract_domain(url)
        content = (page_text if isinstance(page_text, str) and page_text else snippet)

        sources.append(SourceChunk(
            id=i + 1,
            title=title,
            url=url,
            domain=domain,
            snippet=snippet[:300],
            content=content[:2000],
            relevance_score=round(1.0 - i * 0.04, 2),
            date=None,
        ))

    return sources


async def _fetch_content(url: str, timeout: float = 7.0) -> str:
    """Download a page and return its visible text, stripped of boilerplate."""
    if not url or not url.startswith("http"):
        return ""
    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=True,
            headers={"User-Agent": _USER_AGENT},
        ) as client:
            r = await client.get(url)
            r.raise_for_status()
            if "html" not in r.headers.get("content-type", ""):
                return ""
            soup = BeautifulSoup(r.text, "html.parser")
            for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
                tag.decompose()
            return soup.get_text(separator=" ", strip=True)[:2500]
    except Exception:
        return ""


def _extract_domain(url: str) -> str:
    try:
        return urlparse(url).netloc
    except Exception:
        return ""
