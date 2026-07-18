from tavily import AsyncTavilyClient

from app.core.config import get_settings
from app.providers.search.base import SearchResult


class TavilyProvider:
    def __init__(self, api_key: str) -> None:
        self._client = AsyncTavilyClient(api_key=api_key)
        self._settings = get_settings()

    async def search(self, query: str, *, max_results: int) -> list[SearchResult]:
        s = self._settings
        response = await self._client.search(
            query=query, search_depth=s.search_depth, max_results=max_results,
        )
        results = []
        for item in response.get("results", []):
            content = item.get("content", "") or ""
            if s.search_content_max_chars:
                content = content[: s.search_content_max_chars]
            results.append(SearchResult(
                title=item.get("title", "") or "",
                url=item.get("url", "") or "",
                content=content,
                score=item.get("score"),
                published_date=item.get("published_date"),
            ))
        return results


def build_search_provider():
    s = get_settings()
    if s.search_provider == "tavily":
        return TavilyProvider(api_key=s.tavily_api_key)
    raise ValueError(f"Unknown search_provider: {s.search_provider}")
