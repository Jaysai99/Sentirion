"""
twitter_ingestion.py — fetch tweets for market sentiment analysis.

Strategy (in order of preference):
  1. Official Twitter API v2 — requires TWITTER_BEARER_TOKEN env var.
     Free tier: ~500k tweet reads/month. Recommended for production.
  2. ntscraper (Nitter-based) — no API key, scrapes public data.
     Useful for development; availability depends on Nitter instances.

Returned documents share the same schema as news/reddit documents so they
can be passed directly to score_documents() in market_sentiment.py.
"""

from __future__ import annotations

import logging
import os
from typing import Any

import requests

logger = logging.getLogger(__name__)

TWITTER_BEARER_TOKEN = os.getenv("TWITTER_BEARER_TOKEN", "")
TWITTER_SEARCH_URL   = "https://api.twitter.com/2/tweets/search/recent"
REQUEST_TIMEOUT      = 10

# High-signal financial accounts (boost quality weighting in scoring)
QUALITY_ACCOUNTS: set[str] = {
    "federalreserve", "sec_news", "cboeoptions", "imf",
    "goldmansachs", "jpmorgan", "raydalio", "howard_marks",
    "chamath", "naval", "elonmusk", "jimcramer",
    "markets", "wsj", "ft", "bloombergmarkets", "reuters",
    "cnbc", "marketwatch", "benzinga", "seekingalpha",
}


def fetch_twitter_documents(query: str, limit: int = 30) -> list[dict[str, Any]]:
    """
    Fetch tweets relevant to *query* for sentiment scoring.
    Returns [] gracefully if neither backend is available.
    """
    if TWITTER_BEARER_TOKEN:
        docs = _fetch_via_api_v2(query, limit)
        if docs:
            return docs
        logger.warning("Twitter API v2 returned no results — falling back to ntscraper")

    return _fetch_via_ntscraper(query, limit)


# ── Twitter API v2 ────────────────────────────────────────────────────────────

def _fetch_via_api_v2(query: str, limit: int) -> list[dict[str, Any]]:
    """Official Twitter API v2 recent search (7-day window on free tier)."""
    # Build a finance-oriented search query to filter noise
    finance_filter = (
        "(stock OR market OR earnings OR bullish OR bearish OR "
        "invest OR shares OR price OR analyst OR guidance OR revenue)"
    )
    search_query = (
        f"({query} OR ${query.upper()}) {finance_filter} "
        f"lang:en -is:retweet -is:reply"
    )

    try:
        resp = requests.get(
            TWITTER_SEARCH_URL,
            headers={"Authorization": f"Bearer {TWITTER_BEARER_TOKEN}"},
            params={
                "query":       search_query,
                "max_results": min(limit, 100),
                "tweet.fields": "created_at,author_id,public_metrics,text,context_annotations",
                "expansions":   "author_id",
                "user.fields":  "username,name,verified,public_metrics",
            },
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("Twitter API v2 request failed: %s", exc)
        return []

    users = {u["id"]: u for u in data.get("includes", {}).get("users", [])}
    documents: list[dict[str, Any]] = []

    for tweet in data.get("data", []):
        text = tweet.get("text", "")
        if not text or len(text) < 20:
            continue

        metrics   = tweet.get("public_metrics", {})
        author_id = tweet.get("author_id", "")
        user      = users.get(author_id, {})
        username  = user.get("username", "").lower()
        followers = user.get("public_metrics", {}).get("followers_count", 0)
        likes     = metrics.get("like_count", 0)
        retweets  = metrics.get("retweet_count", 0)
        engagement = likes + retweets * 2 + int(followers / 10000)

        documents.append({
            "source":        "twitter",
            "source_name":   "Twitter / X",
            "document_type": "tweet",
            "text":          text,
            "snippet":       text[:480],
            "url":           f"https://twitter.com/{username}/status/{tweet.get('id','')}",
            "metadata": {
                "username":       username,
                "name":           user.get("name", ""),
                "verified":       user.get("verified", False),
                "followers":      followers,
                "likes":          likes,
                "retweets":       retweets,
                "replies":        metrics.get("reply_count", 0),
                "created_at":     tweet.get("created_at"),
                "quality_account": username in QUALITY_ACCOUNTS,
                "engagement":     engagement,
            },
        })

    logger.debug("Twitter API v2 returned %d tweets for %s", len(documents), query)
    return documents


# ── Nitter / ntscraper fallback ───────────────────────────────────────────────

def _fetch_via_ntscraper(query: str, limit: int) -> list[dict[str, Any]]:
    """
    No-auth fallback using the ntscraper library (Nitter frontend scraper).
    Gracefully returns [] if ntscraper is not installed or all instances are down.
    """
    try:
        from ntscraper import Nitter  # type: ignore
    except ImportError:
        logger.debug("ntscraper not installed; skipping Twitter fallback")
        return []

    try:
        scraper = Nitter(log_level=0, skip_instance_check=False)
        search_term = f"{query} stock OR market lang:en"
        result = scraper.get_tweets(search_term, mode="term", number=limit, language="en")
        tweets = result.get("tweets", [])
    except Exception as exc:
        logger.debug("ntscraper failed: %s", exc)
        return []

    documents: list[dict[str, Any]] = []
    for tweet in tweets:
        text = tweet.get("text", "")
        if not text or len(text) < 20:
            continue

        stats    = tweet.get("stats", {})
        user     = tweet.get("user", {})
        username = user.get("username", "").lower()
        likes    = int(stats.get("likes", 0) or 0)
        retweets = int(stats.get("retweets", 0) or 0)

        documents.append({
            "source":        "twitter",
            "source_name":   "Twitter / X",
            "document_type": "tweet",
            "text":          text,
            "snippet":       text[:480],
            "url":           tweet.get("link", ""),
            "metadata": {
                "username":        username,
                "name":            user.get("name", ""),
                "verified":        False,
                "followers":       0,
                "likes":           likes,
                "retweets":        retweets,
                "replies":         int(stats.get("replies", 0) or 0),
                "created_at":      tweet.get("date"),
                "quality_account": username in QUALITY_ACCOUNTS,
                "engagement":      likes + retweets * 2,
            },
        })

    logger.debug("ntscraper returned %d tweets for %s", len(documents), query)
    return documents
