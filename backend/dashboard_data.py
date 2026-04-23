from __future__ import annotations

import math
import statistics
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

try:
    from .financial_data import fetch_index_overview, fetch_stock_snapshot, looks_like_ticker
    from .market_sentiment import fetch_reddit_documents, run_sentiment_pipeline, score_documents
except ImportError:
    from financial_data import fetch_index_overview, fetch_stock_snapshot, looks_like_ticker
    from market_sentiment import fetch_reddit_documents, run_sentiment_pipeline, score_documents

MARKET_WATCHLIST = ("AAPL", "MSFT", "NVDA", "GOOGL", "META", "AMZN", "TSLA", "JPM", "GS", "XOM")
MARKET_CACHE_TTL_SECONDS = 300
MIN_CONFIDENT_DOCUMENTS = 30
MIN_CONFIDENT_REDDIT_DOCUMENTS = 12
MIN_HEATMAP_MENTIONS = 3
EXTREME_SENTIMENT_THRESHOLD = 0.4
_MARKET_OVERVIEW_CACHE: dict[str, tuple[datetime, dict[str, Any]]] = {}


def build_market_overview(reddit_time_range: str = "day") -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    cache_key = reddit_time_range
    cached = _MARKET_OVERVIEW_CACHE.get(cache_key)
    if cached and now - cached[0] < timedelta(seconds=MARKET_CACHE_TTL_SECONDS):
        return cached[1]

    watchlist_entries: list[dict[str, Any]] = []

    for ticker in MARKET_WATCHLIST:
        stock = fetch_stock_snapshot(ticker, include_history=False, include_financials=False)
        reddit_docs = fetch_reddit_documents(
            ticker,
            post_limit=4,
            comments_per_post=0,
            time_range=reddit_time_range,
            sort_modes=("relevance",),
            max_query_variants=1,
        )
        scored_docs = score_documents(reddit_docs)
        sentiment_score = _average_score(scored_docs)

        watchlist_entries.append(
            {
                "ticker": ticker,
                "company_name": stock.get("company_name") if stock else ticker,
                "sector": stock.get("sector") if stock else "Unknown",
                "price": stock.get("price") if stock else None,
                "price_change_pct": stock.get("price_change_pct") if stock else None,
                "market_cap": stock.get("market_cap") if stock else None,
                "sentiment_score": sentiment_score,
                "mentions": len(reddit_docs),
                "confidence_score": _volume_confidence(len(reddit_docs), 4),
                "signal_visible": len(reddit_docs) >= MIN_HEATMAP_MENTIONS,
            }
        )

    _add_relative_positioning(watchlist_entries, key="sentiment_score")

    sector_map: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for entry in watchlist_entries:
        sector_map[entry["sector"] or "Unknown"].append(entry)

    sector_overview = []
    for sector, entries in sector_map.items():
        sector_overview.append(
            {
                "sector": sector,
                "sentiment_score": round(sum(entry["sentiment_score"] for entry in entries) / len(entries), 2),
                "avg_price_change_pct": round(
                    sum((entry["price_change_pct"] or 0) for entry in entries) / len(entries),
                    2,
                ),
                "tickers": [entry["ticker"] for entry in entries],
            }
        )

    sentiment_scores = [entry["sentiment_score"] for entry in watchlist_entries]
    payload = {
        "generated_at": now.isoformat(),
        "indices": fetch_index_overview(),
        "top_traded_tickers": sorted(
            watchlist_entries,
            key=lambda entry: (entry["mentions"], abs(entry["sentiment_score"])),
            reverse=True,
        ),
        "sector_overview": sorted(
            sector_overview,
            key=lambda sector: abs(sector["sentiment_score"]),
            reverse=True,
        ),
        "heatmap": sorted(
            watchlist_entries,
            key=lambda entry: abs(entry["sentiment_score"]),
            reverse=True,
        ),
        "sentiment_distribution": _build_histogram(sentiment_scores),
        "summary": _build_market_overview_summary(watchlist_entries),
    }

    _MARKET_OVERVIEW_CACHE[cache_key] = (now, payload)
    return payload


def build_sentiment_dashboard(query: str, reddit_time_range: str = "week") -> dict[str, Any]:
    base_payload = run_sentiment_pipeline(
        query,
        include_documents=True,
        reddit_time_range=reddit_time_range,
        reddit_post_limit=18,
        reddit_comments_per_post=3,
        sec_sections_per_filing=4,
    )
    documents = base_payload.get("documents", [])
    stock = fetch_stock_snapshot(query) if looks_like_ticker(query) else None
    sentiment_timeline = _build_sentiment_timeline(documents, reddit_time_range)
    source_analytics = _build_source_analytics(documents)
    coverage = _build_coverage(base_payload, documents)
    momentum = _build_momentum(sentiment_timeline)
    historical_positioning = _build_historical_positioning(sentiment_timeline, base_payload.get("score", 0))
    signal_quality = _build_signal_quality(coverage, source_analytics, sentiment_timeline)
    divergence_signal = _build_divergence_signal(source_analytics, base_payload.get("query_kind", "topic"))
    sec_intelligence = _build_sec_intelligence(documents)
    live_stream = _build_live_stream(documents, momentum)
    key_drivers = _build_key_drivers(documents)[:3]
    catalysts = _build_catalysts(
        base_payload,
        stock,
        key_drivers,
        divergence_signal,
        sec_intelligence,
        momentum,
    )
    alerts = _build_alerts(
        base_payload,
        signal_quality,
        divergence_signal,
        live_stream,
        momentum,
    )
    summary = _build_narrative_summary(
        base_payload,
        signal_quality,
        divergence_signal,
        catalysts,
        momentum,
        stock,
        key_drivers,
    )
    actionable_interpretation = _build_actionable_interpretation(
        base_payload,
        signal_quality,
        divergence_signal,
        momentum,
    )

    return {
        **base_payload,
        "score_display": base_payload.get("score") if signal_quality["sufficient_coverage"] else None,
        "coverage": coverage,
        "signal_quality": signal_quality,
        "momentum": momentum,
        "historical_positioning": historical_positioning,
        "divergence_signal": divergence_signal,
        "stock_data": stock,
        "sentiment_timeline": sentiment_timeline,
        "sentiment_volatility": _compute_volatility(documents),
        "key_drivers": key_drivers,
        "top_drivers": key_drivers,
        "source_analytics": source_analytics,
        "live_stream": live_stream,
        "filings_intelligence": sec_intelligence,
        "catalysts": catalysts,
        "signal_analytics": {
            "mention_volume": live_stream["mention_volume"],
            "volume_change_pct": live_stream["volume_change_pct"],
            "rate_of_change": live_stream["rate_of_change"],
            "dispersion": source_analytics["dispersion"],
            "alerts": alerts,
        },
        "summary_panel": summary,
        "narrative_engine": {
            "summary": summary,
            "actionable_interpretation": actionable_interpretation,
            "catalysts": catalysts,
        },
    }


def _build_coverage(base_payload: dict[str, Any], documents: list[dict[str, Any]]) -> dict[str, Any]:
    source_counts = base_payload.get("sources", {})
    reddit_docs = source_counts.get("reddit", 0)
    sec_docs = source_counts.get("sec", 0)
    source_count = len([source for source, count in source_counts.items() if count > 0])

    return {
        "documents_analyzed": base_payload.get("documents_analyzed", 0),
        "reddit_mentions": reddit_docs,
        "sec_passages": sec_docs,
        "sources_used": source_count,
        "coverage_label": (
            f"Analyzed {base_payload.get('documents_analyzed', 0)} documents across {source_count} sources"
        ),
        "institutional_threshold": {
            "documents": MIN_CONFIDENT_DOCUMENTS,
            "reddit_mentions": MIN_CONFIDENT_REDDIT_DOCUMENTS,
        },
    }


def _build_signal_quality(
    coverage: dict[str, Any],
    source_analytics: dict[str, Any],
    sentiment_timeline: list[dict[str, Any]],
) -> dict[str, Any]:
    documents_analyzed = coverage["documents_analyzed"]
    reddit_mentions = coverage["reddit_mentions"]
    document_ratio = min(documents_analyzed / max(MIN_CONFIDENT_DOCUMENTS, 1), 1.0)
    reddit_ratio = min(reddit_mentions / max(MIN_CONFIDENT_REDDIT_DOCUMENTS, 1), 1.0)
    coverage_ratio = min(document_ratio, reddit_ratio)
    sufficient_coverage = (
        documents_analyzed >= MIN_CONFIDENT_DOCUMENTS and reddit_mentions >= MIN_CONFIDENT_REDDIT_DOCUMENTS
    )
    volume_score = coverage_ratio**1.4
    agreement_score = max(0.0, 1 - min(source_analytics["dispersion"], 0.6) / 0.6)
    recency_score = _recency_confidence(sentiment_timeline)
    agreement_score *= 0.3 + coverage_ratio * 0.7
    confidence_score = round((volume_score * 0.6 + agreement_score * 0.2 + recency_score * 0.2) * 100, 1)
    if not sufficient_coverage:
        confidence_cap = round(15 + coverage_ratio * 30, 1)
        confidence_score = min(confidence_score, confidence_cap)

    if confidence_score >= 75:
        label = "High"
    elif confidence_score >= 50:
        label = "Moderate"
    else:
        label = "Low"

    return {
        "confidence_score": confidence_score,
        "confidence_label": label,
        "sufficient_coverage": sufficient_coverage,
        "coverage_ratio": round(coverage_ratio, 3),
        "volume_score": round(volume_score, 3),
        "agreement_score": round(agreement_score, 3),
        "recency_score": round(recency_score, 3),
        "coverage_warning": None
        if sufficient_coverage
        else "Signal suppressed because discussion coverage is below institutional threshold.",
    }


def _build_momentum(sentiment_timeline: list[dict[str, Any]]) -> dict[str, Any]:
    scores = [point["score"] for point in sentiment_timeline if isinstance(point.get("score"), (float, int))]
    if not scores:
        return {
            "delta_1h": 0.0,
            "delta_6h": 0.0,
            "delta_24h": 0.0,
            "acceleration": 0.0,
            "trend": "flat",
            "inflection_detected": False,
            "regime_shift": "none",
            "latest_score": 0.0,
        }

    latest = scores[-1]
    delta_1h = _delta_from_tail(scores, 1)
    delta_6h = _delta_from_tail(scores, 6)
    delta_24h = _delta_from_tail(scores, 24)
    acceleration = delta_6h - (delta_24h / 4 if delta_24h else 0.0)
    trend = "flat"
    if delta_24h >= 0.08:
        trend = "rising"
    elif delta_24h <= -0.08:
        trend = "falling"

    inflection_detected = len(scores) >= 3 and ((scores[-1] > 0 >= scores[-2]) or (scores[-1] < 0 <= scores[-2]))
    regime_shift = "none"
    if inflection_detected:
        regime_shift = "bullish_flip" if latest > 0 else "bearish_flip"
    elif acceleration >= 0.08:
        regime_shift = "bullish_acceleration"
    elif acceleration <= -0.08:
        regime_shift = "bearish_acceleration"

    return {
        "delta_1h": round(delta_1h, 2),
        "delta_6h": round(delta_6h, 2),
        "delta_24h": round(delta_24h, 2),
        "acceleration": round(acceleration, 2),
        "trend": trend,
        "inflection_detected": inflection_detected,
        "regime_shift": regime_shift,
        "latest_score": round(latest, 2),
    }


def _build_historical_positioning(
    sentiment_timeline: list[dict[str, Any]],
    current_score: float,
) -> dict[str, Any]:
    timeline_scores = [point["score"] for point in sentiment_timeline if isinstance(point.get("score"), (float, int))]
    if len(timeline_scores) < 2:
        return {"z_score": None, "percentile": None}

    mean = statistics.mean(timeline_scores)
    std_dev = statistics.pstdev(timeline_scores)
    z_score = None if std_dev == 0 else round((current_score - mean) / std_dev, 2)
    percentile = round(
        (sum(1 for score in timeline_scores if score <= current_score) / len(timeline_scores)) * 100,
        1,
    )
    return {"z_score": z_score, "percentile": percentile}


def _build_divergence_signal(source_analytics: dict[str, Any], query_kind: str) -> dict[str, Any]:
    source_scores = source_analytics.get("source_scores", {})
    reddit_score = source_scores.get("reddit")
    sec_score = source_scores.get("sec")

    if query_kind != "ticker" or reddit_score is None or sec_score is None:
        return {
            "active": False,
            "classification": "not_applicable",
            "spread": None,
            "message": "Cross-source divergence requires both retail and SEC signals.",
        }

    spread = round(reddit_score - sec_score, 2)
    active = abs(spread) >= 0.2
    if not active:
        classification = "aligned"
        if abs(reddit_score) < 0.1 and abs(sec_score) < 0.1:
            message = (
                f"Retail and filing sentiment are both near neutral ({reddit_score:+.2f} vs {sec_score:+.2f}), "
                "indicating no meaningful narrative conflict and limited directional conviction."
            )
        else:
            dominant_side = "bullish" if (reddit_score + sec_score) / 2 > 0 else "bearish"
            message = (
                f"Retail and filing sentiment are aligned on a {dominant_side} skew "
                f"({reddit_score:+.2f} vs {sec_score:+.2f}), so there is no material cross-source disconnect."
            )
    elif reddit_score < sec_score:
        classification = "retail_more_bearish"
        message = (
            f"Retail sentiment is more bearish than filing tone ({reddit_score:+.2f} vs {sec_score:+.2f}), "
            "suggesting a flow-driven drawdown rather than a filing-confirmed deterioration."
        )
    else:
        classification = "retail_more_bullish"
        message = (
            f"Retail sentiment is more bullish than filing tone ({reddit_score:+.2f} vs {sec_score:+.2f}), "
            "suggesting momentum-driven optimism without filing confirmation."
        )

    return {
        "active": active,
        "classification": classification,
        "spread": spread,
        "message": message,
    }


def _build_live_stream(documents: list[dict[str, Any]], momentum: dict[str, Any]) -> dict[str, Any]:
    reddit_docs = [document for document in documents if document.get("source") == "reddit"]
    reddit_docs_sorted = sorted(
        reddit_docs,
        key=lambda document: document.get("metadata", {}).get("created_at") or "",
        reverse=True,
    )
    timestamps = [
        _parse_iso_datetime(document.get("metadata", {}).get("created_at"))
        for document in reddit_docs_sorted
        if document.get("metadata", {}).get("created_at")
    ]
    timestamps = [timestamp for timestamp in timestamps if timestamp]
    now = datetime.now(timezone.utc)
    latest_window = sum(1 for timestamp in timestamps if now - timestamp <= timedelta(hours=6))
    previous_window = sum(1 for timestamp in timestamps if timedelta(hours=6) < now - timestamp <= timedelta(hours=12))
    volume_change_pct = None
    if previous_window > 0:
        volume_change_pct = round(((latest_window - previous_window) / previous_window) * 100, 1)
    elif latest_window > 0:
        volume_change_pct = 100.0

    return {
        "mention_volume": len(reddit_docs_sorted),
        "latest_window_mentions": latest_window,
        "previous_window_mentions": previous_window,
        "volume_change_pct": volume_change_pct,
        "rate_of_change": momentum["delta_6h"],
        "items": reddit_docs_sorted[:10],
    }


def _build_sec_intelligence(documents: list[dict[str, Any]]) -> dict[str, Any]:
    sec_docs = [document for document in documents if document.get("source") == "sec"]
    filings_by_type_and_date: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)

    for document in sec_docs:
        metadata = document.get("metadata", {})
        filing_type = document.get("document_type", "SEC")
        filed_at = metadata.get("filed_at") or "undated"
        filings_by_type_and_date[(filing_type, filed_at)].append(document)

    filing_summaries = []
    filings_by_type: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for (filing_type, filed_at), filing_docs in filings_by_type_and_date.items():
        avg_score = round(sum(document.get("sentiment_score", 0) for document in filing_docs) / len(filing_docs), 2)
        filing_summary = {
            "filing_type": filing_type,
            "filed_at": filed_at,
            "avg_sentiment": avg_score,
            "section_count": len(filing_docs),
        }
        filing_summaries.append(filing_summary)
        filings_by_type[filing_type].append(filing_summary)

    for filing_type, entries in filings_by_type.items():
        sorted_entries = sorted(entries, key=lambda entry: entry["filed_at"], reverse=True)
        previous_score = None
        for entry in sorted_entries:
            if previous_score is None:
                entry["change_vs_previous"] = None
                entry["tone_change_label"] = "baseline"
            else:
                entry["change_vs_previous"] = round(entry["avg_sentiment"] - previous_score, 2)
                entry["tone_change_label"] = _classify_filing_change(entry["change_vs_previous"])
            previous_score = entry["avg_sentiment"]

    key_sections = []
    for document in _build_key_drivers(sec_docs)[:6]:
        key_sections.append(
            {
                **document,
                "section_theme": document.get("metadata", {}).get("section_theme")
                or _infer_filing_theme(document.get("snippet", "")),
                "section_heading": document.get("metadata", {}).get("section_heading"),
            }
        )

    return {
        "filings": sorted(filing_summaries, key=lambda entry: entry["filed_at"], reverse=True),
        "key_sections": key_sections,
    }


def _build_key_drivers(documents: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ranked = sorted((document for document in documents if _is_driver_candidate(document)), key=_impact_score, reverse=True)
    drivers = []

    for document in ranked:
        driver_topic = _extract_topic_phrase(document.get("snippet", ""))
        drivers.append(
            {
                **document,
                "impact_score": round(_impact_score(document), 3),
                "driver_topic": driver_topic,
                "why_it_matters": _explain_driver(document, driver_topic),
            }
        )

    return drivers


def _build_catalysts(
    base_payload: dict[str, Any],
    stock: dict[str, Any] | None,
    key_drivers: list[dict[str, Any]],
    divergence_signal: dict[str, Any],
    sec_intelligence: dict[str, Any],
    momentum: dict[str, Any],
) -> list[str]:
    catalysts: list[str] = []
    primary_driver = key_drivers[0] if key_drivers else None
    primary_topic = primary_driver.get("driver_topic") if primary_driver else None

    if stock and isinstance(stock.get("price_change_pct"), (int, float)) and abs(stock["price_change_pct"]) >= 1.0:
        direction = "upside" if stock["price_change_pct"] > 0 else "downside"
        catalysts.append(f"{stock['ticker']} sentiment is being influenced by {direction} price momentum of {stock['price_change_pct']:+.2f}% on the day.")

    if primary_driver and primary_topic:
        catalysts.append(
            f"Highest-impact discussion is centered on {primary_topic}, which is { _driver_direction_word(primary_driver) } tone."
        )

    filings = sec_intelligence.get("filings", [])
    if not filings:
        catalysts.append("No recent SEC filing tone is available, so the move appears discussion-driven.")
    elif filings[0].get("change_vs_previous") is None or abs(filings[0].get("change_vs_previous") or 0) < 0.08:
        catalysts.append("SEC filing tone remains broadly stable versus the previous filing, so there is no new fundamental confirmation.")
    else:
        catalysts.append(
            f"{filings[0]['filing_type']} tone changed {filings[0]['change_vs_previous']:+.2f} versus the previous filing."
        )

    if divergence_signal.get("active"):
        catalysts.append(divergence_signal["message"])

    if momentum.get("regime_shift") == "bullish_flip":
        catalysts.append("Sentiment flipped from negative to positive in the latest window, indicating a bullish regime shift.")
    elif momentum.get("regime_shift") == "bearish_flip":
        catalysts.append("Sentiment flipped from positive to negative in the latest window, indicating a bearish regime shift.")
    elif momentum.get("regime_shift") == "bullish_acceleration":
        catalysts.append("Positive sentiment is accelerating faster than the broader 24h trend.")
    elif momentum.get("regime_shift") == "bearish_acceleration":
        catalysts.append("Negative sentiment is accelerating faster than the broader 24h trend.")

    if not catalysts:
        catalysts.append("No clear catalyst identified beyond normal flow and discussion variation.")

    return catalysts[:4]


def _build_alerts(
    base_payload: dict[str, Any],
    signal_quality: dict[str, Any],
    divergence_signal: dict[str, Any],
    live_stream: dict[str, Any],
    momentum: dict[str, Any],
) -> list[dict[str, str]]:
    alerts: list[dict[str, str]] = []
    score = base_payload.get("score", 0)

    if not signal_quality["sufficient_coverage"]:
        alerts.append(
            {
                "severity": "medium",
                "title": "Low Coverage",
                "description": signal_quality["coverage_warning"],
            }
        )
    if score >= EXTREME_SENTIMENT_THRESHOLD:
        alerts.append(
            {
                "severity": "high",
                "title": "Extreme Bullish Reading",
                "description": f"Sentiment reached {score:+.2f}, an extreme bullish reading.",
            }
        )
    if score <= -EXTREME_SENTIMENT_THRESHOLD:
        alerts.append(
            {
                "severity": "high",
                "title": "Extreme Bearish Reading",
                "description": f"Sentiment reached {score:+.2f}, an extreme bearish reading.",
            }
        )
    if abs(momentum["delta_6h"]) >= 0.2:
        alerts.append(
            {
                "severity": "high",
                "title": "Sentiment Spike",
                "description": f"Sentiment moved {momentum['delta_6h']:+.2f} in the last 6h, which is an unusually sharp directional move.",
            }
        )
    if abs(momentum.get("acceleration", 0)) >= 0.08:
        alerts.append(
            {
                "severity": "high",
                "title": "Momentum Acceleration",
                "description": f"Short-window momentum accelerated by {momentum['acceleration']:+.2f} versus the broader 24h trend.",
            }
        )
    if live_stream.get("volume_change_pct") is not None and live_stream["volume_change_pct"] >= 100:
        alerts.append(
            {
                "severity": "high",
                "title": "Volume Surge",
                "description": f"Discussion volume is up {live_stream['volume_change_pct']:+.1f}% versus the prior 6h window.",
            }
        )
    if divergence_signal.get("spread") is not None and abs(divergence_signal["spread"]) >= 0.35:
        alerts.append(
            {
                "severity": "high",
                "title": "Divergence Event",
                "description": f"Retail and filing sentiment are separated by {divergence_signal['spread']:+.2f}, which is a material cross-source disconnect.",
            }
        )
    if divergence_signal.get("active"):
        alerts.append(
            {
                "severity": "medium",
                "title": "Cross-Source Divergence",
                "description": divergence_signal["message"],
            }
        )

    return alerts


def _build_narrative_summary(
    base_payload: dict[str, Any],
    signal_quality: dict[str, Any],
    divergence_signal: dict[str, Any],
    catalysts: list[str],
    momentum: dict[str, Any],
    stock: dict[str, Any] | None,
    key_drivers: list[dict[str, Any]],
) -> str:
    primary_driver = _select_primary_driver(key_drivers)
    driver_clause = ""
    if primary_driver:
        driver_clause = (
            f" The strongest driver is {primary_driver.get('driver_topic', 'discussion flow')}, "
            f"coming from {_source_phrase(primary_driver)}."
        )

    fundamentals_phrase = divergence_signal["message"]
    price_phrase = ""
    if stock and isinstance(stock.get("price_change_pct"), (int, float)):
        price_phrase = f" The stock is {stock['price_change_pct']:+.2f}% on the day."

    quality_phrase = (
        "Signal quality is high."
        if signal_quality["confidence_label"] == "High"
        else "Signal quality is moderate."
        if signal_quality["confidence_label"] == "Moderate"
        else "Signal quality is low and should be treated cautiously."
    )

    return (
        f"Aggregate sentiment is {base_payload.get('score', 0):+.2f} across {base_payload.get('documents_analyzed', 0)} documents. "
        f"{fundamentals_phrase}{driver_clause}{price_phrase} {quality_phrase}"
    )


def _build_actionable_interpretation(
    base_payload: dict[str, Any],
    signal_quality: dict[str, Any],
    divergence_signal: dict[str, Any],
    momentum: dict[str, Any],
) -> str:
    score = base_payload.get("score", 0)

    if not signal_quality["sufficient_coverage"]:
        return "No trade: signal strength is below threshold due to limited coverage. Wait for more discussion volume or filing confirmation before treating this as directional."

    if divergence_signal.get("classification") == "retail_more_bearish":
        return "Watch for a short-term overreaction setup: retail is materially more bearish than filings, so downside tone looks flow-driven rather than fundamentally confirmed."
    if divergence_signal.get("classification") == "retail_more_bullish":
        return "Treat the move as momentum-led rather than fundamentals-led: retail optimism is outrunning filing tone and still needs confirmation."
    if score <= -0.2 and momentum["trend"] == "falling":
        return "Bearish sentiment is broadening with momentum confirmation, which supports near-term downside caution."
    if score >= 0.2 and momentum["trend"] == "rising":
        return "Bullish sentiment is strengthening with improving momentum, which supports a near-term constructive bias."
    return "No strong trade bias: sentiment is directionally weak or balanced across sources, so use it as context rather than a standalone trigger."


def _average_score(documents: list[Any]) -> float:
    if not documents:
        return 0.0
    return round(sum(document.sentiment_score for document in documents) / len(documents), 2)


def _build_histogram(scores: list[float]) -> list[dict[str, Any]]:
    buckets = [(-1.0, -0.5), (-0.5, -0.1), (-0.1, 0.1), (0.1, 0.5), (0.5, 1.0)]
    histogram = []

    for start, end in buckets:
        histogram.append(
            {
                "label": f"{start:.1f} to {end:.1f}",
                "count": sum(1 for score in scores if start <= score < end or (end == 1.0 and score == 1.0)),
            }
        )

    return histogram


def _build_market_overview_summary(watchlist_entries: list[dict[str, Any]]) -> str:
    if not watchlist_entries:
        return "Market overview unavailable."

    strongest = max(watchlist_entries, key=lambda entry: entry["sentiment_score"])
    weakest = min(watchlist_entries, key=lambda entry: entry["sentiment_score"])
    avg_score = round(sum(entry["sentiment_score"] for entry in watchlist_entries) / len(watchlist_entries), 2)
    return (
        f"Watchlist sentiment averages {avg_score:+.2f}. "
        f"{strongest['ticker']} is the strongest read, while {weakest['ticker']} is the weakest."
    )


def _build_sentiment_timeline(documents: list[dict[str, Any]], reddit_time_range: str) -> list[dict[str, Any]]:
    bucketed_scores: dict[str, list[float]] = defaultdict(list)
    use_hourly = reddit_time_range == "day"

    for document in documents:
        timestamp = document.get("metadata", {}).get("created_at") or document.get("metadata", {}).get("filed_at")
        if not timestamp:
            continue

        parsed = _parse_iso_datetime(timestamp)
        if not parsed:
            continue

        bucket = parsed.strftime("%Y-%m-%dT%H:00:00Z") if use_hourly else parsed.strftime("%Y-%m-%d")
        bucketed_scores[bucket].append(document.get("sentiment_score", 0))

    return [
        {
            "bucket": bucket,
            "score": round(sum(scores) / len(scores), 2),
            "documents": len(scores),
        }
        for bucket, scores in sorted(bucketed_scores.items())
    ]


def _compute_volatility(documents: list[dict[str, Any]]) -> float:
    scores = [document.get("sentiment_score", 0.0) for document in documents]
    if len(scores) < 2:
        return 0.0
    return round(statistics.pstdev(scores), 4)


def _build_source_analytics(documents: list[dict[str, Any]]) -> dict[str, Any]:
    grouped_scores: dict[str, list[float]] = defaultdict(list)

    for document in documents:
        grouped_scores[document.get("source", "unknown")].append(document.get("sentiment_score", 0))

    source_scores = {
        source: round(sum(scores) / len(scores), 2)
        for source, scores in grouped_scores.items()
    }
    dispersion = 0.0
    if len(source_scores) >= 2:
        dispersion = round(statistics.pstdev(source_scores.values()), 4)

    return {"source_scores": source_scores, "dispersion": dispersion}


def _impact_score(document: dict[str, Any]) -> float:
    relevance = float(document.get("metadata", {}).get("relevance_score") or 0)
    engagement = float(document.get("metadata", {}).get("score") or 0)
    base = abs(document.get("sentiment_score", 0)) * max(document.get("confidence", 0), 0.01)
    return base * (1 + relevance / 10) * (1 + min(max(engagement, 0), 500) / 250)


def _explain_driver(document: dict[str, Any], driver_topic: str) -> str:
    source = document.get("source")
    direction = _driver_direction_word(document)
    if source == "sec":
        section_theme = document.get("metadata", {}).get("section_theme") or "filing language"
        return f"{section_theme} language focused on {driver_topic} is setting a {direction} filing tone."
    return f"High-impact retail discussion focused on {driver_topic} is pushing sentiment {direction}."


def _volume_confidence(value: int, target: int) -> float:
    if target <= 0:
        return 1.0
    return min(value / target, 1.0)


def _recency_confidence(sentiment_timeline: list[dict[str, Any]]) -> float:
    if not sentiment_timeline:
        return 0.2
    latest_bucket = sentiment_timeline[-1]["bucket"]
    parsed = _parse_iso_datetime(latest_bucket if "T" in latest_bucket else f"{latest_bucket}T00:00:00+00:00")
    if not parsed:
        return 0.5
    age_hours = (datetime.now(timezone.utc) - parsed).total_seconds() / 3600
    if age_hours <= 6:
        return 1.0
    if age_hours <= 24:
        return 0.8
    if age_hours <= 72:
        return 0.6
    return 0.4


def _delta_from_tail(values: list[float], steps: int) -> float:
    if len(values) <= steps:
        return values[-1] - values[0] if len(values) >= 2 else 0.0
    return values[-1] - values[-steps - 1]


def _add_relative_positioning(entries: list[dict[str, Any]], key: str) -> None:
    values = [entry.get(key) for entry in entries if isinstance(entry.get(key), (float, int))]
    if len(values) < 2:
        return

    mean = statistics.mean(values)
    std_dev = statistics.pstdev(values)

    for entry in entries:
        value = entry.get(key)
        if not isinstance(value, (float, int)):
            entry["z_score"] = None
            entry["percentile"] = None
            continue

        entry["z_score"] = None if std_dev == 0 else round((value - mean) / std_dev, 2)
        entry["percentile"] = round(
            (sum(1 for candidate in values if candidate <= value) / len(values)) * 100,
            1,
        )


def _classify_filing_change(change_value: float) -> str:
    if change_value >= 0.1:
        return "tone improved"
    if change_value <= -0.1:
        return "risk language increased"
    return "tone stable"


def _infer_filing_theme(snippet: str) -> str:
    lowered = snippet.lower()
    if "risk" in lowered:
        return "Risk Factors"
    if "management" in lowered or "discussion" in lowered or "liquidity" in lowered:
        return "MD&A"
    if "revenue" in lowered or "margin" in lowered or "profit" in lowered:
        return "Operating Results"
    return "Disclosure"


def _is_driver_candidate(document: dict[str, Any]) -> bool:
    snippet = (document.get("snippet") or "").strip()
    if len(snippet) < 70:
        return False
    if document.get("source") == "sec":
        return (document.get("metadata", {}).get("section_theme") or _infer_filing_theme(snippet)) != "Disclosure"
    return True


def _extract_topic_phrase(snippet: str) -> str:
    lowered = snippet.lower()
    if "magnificent 7" in lowered or "mag 7" in lowered:
        return "large-cap tech downside discussion"
    if "taiwan" in lowered:
        return "Taiwan supply-chain risk"
    if "china" in lowered or "tariff" in lowered:
        return "China and tariff exposure"
    if "iphone" in lowered or "ios" in lowered:
        return "product-cycle expectations"
    if "chip" in lowered or "semiconductor" in lowered or "gpu" in lowered:
        return "semiconductor demand expectations"
    if "option" in lowered or "call" in lowered or "put" in lowered:
        return "options flow"
    if "guidance" in lowered or "outlook" in lowered:
        return "forward guidance"
    if "revenue" in lowered or "margin" in lowered or "earnings" in lowered:
        return "earnings and operating performance"
    if "risk" in lowered or "portfolio" in lowered or "hedge" in lowered:
        return "portfolio-risk positioning"
    if "valuation" in lowered or "multiple" in lowered or "pe" in lowered:
        return "valuation debate"
    if "buyback" in lowered or "capital return" in lowered:
        return "capital return expectations"
    if "demand" in lowered or "consumer" in lowered:
        return "end-demand expectations"
    return _extract_anchor_excerpt(snippet)


def _extract_anchor_excerpt(snippet: str) -> str:
    cleaned = snippet.strip().rstrip(".")
    if not cleaned:
        return "current discussion flow"
    words = cleaned.split()
    return " ".join(words[:6]).lower()


def _driver_direction_word(document: dict[str, Any]) -> str:
    score = document.get("sentiment_score", 0)
    if score >= 0.1:
        return "more bullish"
    if score <= -0.1:
        return "more bearish"
    return "toward neutral"


def _source_phrase(document: dict[str, Any]) -> str:
    if document.get("source") == "sec":
        section_theme = document.get("metadata", {}).get("section_theme") or "filings"
        return f"the {section_theme} section of the latest filing"
    subreddit = document.get("metadata", {}).get("subreddit")
    if subreddit:
        return f"Reddit discussion in r/{subreddit}"
    return "Reddit discussion"


def _select_primary_driver(key_drivers: list[dict[str, Any]]) -> dict[str, Any] | None:
    if not key_drivers:
        return None
    ranked = sorted(
        key_drivers,
        key=lambda driver: (
            0 if driver.get("driver_topic") not in {"current discussion flow"} else 1,
            -driver.get("impact_score", 0),
        ),
    )
    return ranked[0]


def _parse_iso_datetime(value: str) -> datetime | None:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None
