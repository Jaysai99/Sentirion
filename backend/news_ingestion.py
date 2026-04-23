"""
news_ingestion.py — financial news aggregation from multiple sources.

Sources (in priority order):
  1. yfinance ticker.news — stock-specific articles from Yahoo Finance
  2. RSS feeds — Reuters, CNBC, MarketWatch, Barron's, WSJ, FT, Benzinga, Seeking Alpha
  3. NewsAPI.org — optional; set NEWSAPI_KEY env var for access to WSJ/FT/Bloomberg

All returned documents share the same schema as SourceDocument so they can be
passed directly to score_documents() in market_sentiment.py.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any

import feedparser
import requests
import yfinance as yf

logger = logging.getLogger(__name__)

# ── RSS feed registry ─────────────────────────────────────────────────────────
NEWS_RSS_FEEDS: dict[str, str] = {
    "Reuters Business":     "https://feeds.reuters.com/reuters/businessNews",
    "Reuters Technology":   "https://feeds.reuters.com/reuters/technologyNews",
    "Reuters Finance":      "https://feeds.reuters.com/reuters/financialsNews",
    "CNBC Top News":        "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114",
    "CNBC Finance":         "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664",
    "CNBC Earnings":        "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=15839135",
    "MarketWatch":          "https://feeds.marketwatch.com/marketwatch/topstories/",
    "MarketWatch Markets":  "https://feeds.marketwatch.com/marketwatch/marketpulse/",
    "Barron's":             "https://www.barrons.com/xml/rss/3_7510.xml",
    "Seeking Alpha":        "https://seekingalpha.com/market_currents.xml",
    "Benzinga":             "https://www.benzinga.com/feed",
    "Investopedia":         "https://www.investopedia.com/feedbuilder/feed/getfeed?feedName=rss_headline",
    "Yahoo Finance":        "https://finance.yahoo.com/news/rssindex",
    "WSJ Markets":          "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
    "FT Markets":           "https://www.ft.com/rss/home/uk",
}

# NewsAPI config
NEWSAPI_KEY  = os.getenv("NEWSAPI_KEY", "")
NEWSAPI_BASE = "https://newsapi.org/v2"
NEWSAPI_DOMAINS = (
    "reuters.com,cnbc.com,marketwatch.com,seekingalpha.com,"
    "barrons.com,benzinga.com,investing.com,yahoo.com,"
    "wsj.com,ft.com,bloomberg.com,businessinsider.com,"
    "thestreet.com,motleyfool.com,zacks.com"
)

REQUEST_TIMEOUT = 8


# ── Public API ────────────────────────────────────────────────────────────────

def fetch_news_documents(query: str, limit: int = 40) -> list[dict[str, Any]]:
    """
    Return news documents for *query* (ticker or topic), ready for FinBERT scoring.
    Aggregates from yfinance + RSS + NewsAPI (if key present), then deduplicates.
    """
    documents: list[dict[str, Any]] = []

    documents.extend(_fetch_yfinance_news(query, limit=20))
    documents.extend(_fetch_rss_news(query, limit=30))

    if NEWSAPI_KEY:
        documents.extend(_fetch_newsapi(query, limit=15))

    # Deduplicate on normalised headline
    seen: set[str] = set()
    unique: list[dict[str, Any]] = []
    for doc in documents:
        key = doc["snippet"].lower().strip()[:100]
        if key and key not in seen:
            seen.add(key)
            unique.append(doc)

    return unique[:limit]


def fetch_general_news_documents(limit: int = 30) -> list[dict[str, Any]]:
    """Market-wide news not tied to a specific ticker (for market overview)."""
    documents: list[dict[str, Any]] = []
    for name, url in list(NEWS_RSS_FEEDS.items())[:6]:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:5]:
                title = getattr(entry, "title", "")
                summary = getattr(entry, "summary", "")
                if not title:
                    continue
                documents.append(_make_news_doc(
                    source_name=name,
                    title=title,
                    summary=summary,
                    url=getattr(entry, "link", ""),
                    published_at=_parse_struct_time(getattr(entry, "published_parsed", None)),
                ))
        except Exception as exc:
            logger.debug("General RSS failed for %s: %s", name, exc)
    return documents[:limit]


# ── Private helpers ───────────────────────────────────────────────────────────

def _fetch_yfinance_news(query: str, limit: int = 20) -> list[dict[str, Any]]:
    """Ticker-specific news from yfinance (Yahoo Finance backend)."""
    try:
        items = yf.Ticker(query.upper()).news or []
        documents = []
        for item in items[:limit]:
            # New format: item["content"] dict (yfinance >= 0.2.50)
            content = item.get("content", {})
            if content:
                title     = content.get("title", "")
                summary   = content.get("summary", "") or content.get("description", "")
                pub_iso   = content.get("pubDate")  # already ISO: "2026-04-22T10:30:00Z"
                publisher = content.get("provider", {}).get("displayName", "Yahoo Finance")
                url       = (content.get("canonicalUrl", {}).get("url", "")
                             or content.get("clickThroughUrl", {}).get("url", ""))
                resolutions = content.get("thumbnail", {}).get("resolutions", [])
                thumbnail   = resolutions[0].get("url") if resolutions else None
            else:
                # Legacy flat format fallback
                title     = item.get("title", "")
                summary   = item.get("summary", "")
                pub       = item.get("providerPublishTime", 0)
                pub_iso   = datetime.fromtimestamp(pub, tz=timezone.utc).isoformat() if pub else None
                publisher = item.get("publisher", "Yahoo Finance")
                url       = item.get("link", "")
                thumbnail = _extract_thumbnail(item)

            if not title:
                continue
            documents.append(_make_news_doc(
                source_name=publisher,
                title=title,
                summary=summary,
                url=url,
                published_at=pub_iso,
                thumbnail=thumbnail,
            ))
        return documents
    except Exception as exc:
        logger.debug("yfinance news failed: %s", exc)
        return []


def _fetch_rss_news(query: str, limit: int = 30) -> list[dict[str, Any]]:
    """Search all RSS feeds for entries mentioning *query*."""
    query_terms = {query.lower(), f"${query.upper()}", query.upper()}
    documents: list[dict[str, Any]] = []

    for name, url in NEWS_RSS_FEEDS.items():
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:40]:
                title   = getattr(entry, "title", "")
                summary = getattr(entry, "summary", "")
                combined = f"{title} {summary}".lower()

                if not any(t.lower() in combined for t in query_terms):
                    continue

                documents.append(_make_news_doc(
                    source_name=name,
                    title=title,
                    summary=summary,
                    url=getattr(entry, "link", ""),
                    published_at=_parse_struct_time(getattr(entry, "published_parsed", None)),
                ))
                if len(documents) >= limit:
                    return documents
        except Exception as exc:
            logger.debug("RSS failed for %s: %s", name, exc)

    return documents


def _fetch_newsapi(query: str, limit: int = 15) -> list[dict[str, Any]]:
    """NewsAPI.org for premium source coverage (WSJ, FT, Bloomberg, etc.)."""
    try:
        resp = requests.get(
            f"{NEWSAPI_BASE}/everything",
            params={
                "q":        query,
                "language": "en",
                "sortBy":   "publishedAt",
                "pageSize": limit,
                "domains":  NEWSAPI_DOMAINS,
            },
            headers={"X-Api-Key": NEWSAPI_KEY},
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        documents = []
        for article in resp.json().get("articles", []):
            title       = article.get("title", "")
            description = article.get("description", "")
            if not title or title == "[Removed]":
                continue
            documents.append(_make_news_doc(
                source_name=article.get("source", {}).get("name", "NewsAPI"),
                title=title,
                summary=description or "",
                url=article.get("url", ""),
                published_at=article.get("publishedAt"),
            ))
        return documents
    except Exception as exc:
        logger.debug("NewsAPI failed: %s", exc)
        return []


def _make_news_doc(
    *,
    source_name: str,
    title: str,
    summary: str,
    url: str,
    published_at: str | None,
    thumbnail: str | None = None,
) -> dict[str, Any]:
    body = f"{title}. {summary}".strip(". ") if summary else title
    return {
        "source":        "news",
        "source_name":   source_name,
        "document_type": "news_article",
        "text":          body,
        "snippet":       title,
        "url":           url,
        "metadata": {
            "title":        title,
            "publisher":    source_name,
            "published_at": published_at,
            "thumbnail":    thumbnail,
            "url":          url,
        },
    }


def _parse_struct_time(st: Any) -> str | None:
    if st is None:
        return None
    try:
        return datetime(*st[:6], tzinfo=timezone.utc).isoformat()
    except Exception:
        return None


def _extract_thumbnail(item: dict[str, Any]) -> str | None:
    try:
        resolutions = item.get("thumbnail", {}).get("resolutions", [])
        return resolutions[0].get("url") if resolutions else None
    except Exception:
        return None
