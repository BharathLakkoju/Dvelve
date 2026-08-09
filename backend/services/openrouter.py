import httpx
import json
import os
from typing import AsyncGenerator, Optional
from dotenv import load_dotenv

load_dotenv()

# FIX: API key lives only in the backend environment — it is never sent to or
# read from the frontend/browser, avoiding exposure of a billable credential.
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
# "openrouter/free" is OpenRouter's own auto-router alias to a currently-available
# free-tier model, so this default doesn't rot as individual free model slugs
# get renamed or retired. Override with OPENROUTER_MODEL for a specific model.
OPENROUTER_DEFAULT_MODEL = os.getenv("OPENROUTER_MODEL", "openrouter/free")


class OpenRouterService:
    """Cloud LLM provider used for online mode — mirrors OllamaService's
    interface (is_available/generate/generate_stream) so agents can treat
    the two providers interchangeably."""

    def __init__(self, api_key: str = OPENROUTER_API_KEY, base_url: str = OPENROUTER_BASE_URL):
        self.api_key = api_key
        self.base_url = base_url

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            # Required by OpenRouter for attribution on free-tier usage.
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "Dvelve",
        }

    async def is_available(self) -> bool:
        # Online mode requires a configured API key; we don't probe the network
        # here (that would cost a request) — actual reachability failures
        # surface as RuntimeErrors from generate()/generate_stream().
        return bool(self.api_key)

    async def generate(
        self,
        model: Optional[str],
        prompt: str,
        system: Optional[str] = None,
        stream: bool = False,
    ) -> str:
        """Non-streaming generation — returns full completion."""
        if not self.api_key:
            raise RuntimeError(
                "OPENROUTER_API_KEY is not set. Add it to backend/.env to use online mode."
            )
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        payload = {
            "model": model or OPENROUTER_DEFAULT_MODEL,
            "messages": messages,
            "stream": False,
            "temperature": 0.3,
            # FIX: without an explicit cap, OpenRouter/the routed provider applies
            # its own (sometimes small) default and silently truncates output —
            # e.g. planner JSON or a critic verdict getting cut off mid-response.
            "max_tokens": 1200,
        }
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                r = await client.post(
                    f"{self.base_url}/chat/completions", json=payload, headers=self._headers()
                )
                data = r.json()
                if "error" in data:
                    raise RuntimeError(data["error"].get("message", "OpenRouter request failed"))
                r.raise_for_status()
                choices = data.get("choices") or []
                if not choices:
                    return ""
                return choices[0].get("message", {}).get("content", "") or ""
        except RuntimeError:
            raise
        except Exception as e:
            raise RuntimeError(f"OpenRouter generate failed: {e}")

    async def generate_stream(
        self,
        model: Optional[str],
        prompt: str,
        system: Optional[str] = None,
    ) -> AsyncGenerator[str, None]:
        """Streaming generation — yields tokens as they arrive."""
        if not self.api_key:
            raise RuntimeError(
                "OPENROUTER_API_KEY is not set. Add it to backend/.env to use online mode."
            )
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        payload = {
            "model": model or OPENROUTER_DEFAULT_MODEL,
            "messages": messages,
            "stream": True,
            "temperature": 0.4,
            # FIX: same truncation risk as generate() above. Sized generously above
            # even an overshot "deep" report, since free-tier models frequently
            # ignore the requested word count — a hard truncation mid-sentence is a
            # severe, avoidable critic penalty, worse than a slightly long report.
            "max_tokens": 4096,
        }
        async with httpx.AsyncClient(timeout=180.0) as client:
            async with client.stream(
                "POST", f"{self.base_url}/chat/completions", json=payload, headers=self._headers()
            ) as response:
                if response.status_code != 200:
                    body = await response.aread()
                    try:
                        err = json.loads(body).get("error", {}).get("message")
                    except Exception:
                        err = body.decode("utf-8", errors="ignore")[:300]
                    raise RuntimeError(err or f"OpenRouter returned HTTP {response.status_code}")

                async for line in response.aiter_lines():
                    line = line.strip()
                    if not line or not line.startswith("data:"):
                        continue
                    data_str = line[len("data:"):].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data_str)
                    except json.JSONDecodeError:
                        continue
                    if "error" in chunk:
                        raise RuntimeError(chunk["error"].get("message", "OpenRouter stream error"))
                    choices = chunk.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta", {}) or {}
                    token = delta.get("content", "")
                    if token:
                        yield token


openrouter_service = OpenRouterService()
